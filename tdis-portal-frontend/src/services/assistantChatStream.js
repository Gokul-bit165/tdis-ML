import {
  iterateSseDataPayloads,
  coalesceStreamEventsForUi,
  parseSsePayloadToJsonEvents,
} from '@/services/aiAssistantService';
import { parseOrchestratorResponse } from '@/services/parseOrchestratorResponse';
import { PortalApiError } from '@/services/threadService';
import {
  createStreamingMapAccumulator,
  mergeMapRecordsByHexId,
} from '@/services/streamingMapAccumulator';

/**
 * @param {object|null} response
 * @param {string} turnId
 * @returns {{ segments: Array<object>, mapRecords: unknown }}
 */
export function segmentsFromOrchestratorResponse(response, turnId) {
  const { assistantText, assistantSegments, mapRecords } = parseOrchestratorResponse(
    response,
    turnId
  );
  let segments = assistantSegments?.length ? assistantSegments : [];
  if (!segments.length && assistantText) {
    segments = [
      {
        id: 'seg-fallback',
        text: assistantText,
        role: 'content',
        variant: 'answer',
      },
    ];
  }
  return { segments, mapRecords };
}

export function isAbortError(err) {
  return err?.name === 'AbortError';
}

export function clearStreamingFlag(setTurns, turnId) {
  setTurns((prev) =>
    prev.map((turn) => (turn.id === turnId ? { ...turn, _isStreaming: false } : turn))
  );
}

export function updateTurn(setTurns, turnId, getChanges) {
  setTurns((previousTurns) =>
    previousTurns.map((turn) => (turn.id === turnId ? { ...turn, ...getChanges(turn) } : turn))
  );
}

export function markMapTurn(mapRecords, turnId, setLastMapTurnId) {
  if (mapRecords?.length) setLastMapTurnId(turnId);
}

export async function ingestPayloadEvents({
  payload,
  parsedEvents,
  mapStream,
  streamAbort,
  turnId,
  setTurns,
  setLastMapTurnId,
}) {
  for (const event of parseSsePayloadToJsonEvents(payload)) {
    if (streamAbort.signal.aborted) return;
    parsedEvents.push(event);
    const rowsBefore = mapStream.getMerged()?.length ?? 0;
    mapStream.ingestEvent(event, payload);
    const mapForUi = mapStream.getMerged();
    if ((mapForUi?.length ?? 0) <= rowsBefore) continue;

    updateTurn(setTurns, turnId, (turn) => ({
      mapRecords: mapForUi,
      mapColumns: mapStream.getColumns(),
      rawResponse: turn.rawResponse,
      _isStreaming: true,
    }));
    markMapTurn(mapForUi, turnId, setLastMapTurnId);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export function publishPartialResponse({
  partialResponse,
  mapStream,
  streamAbort,
  turnId,
  setTurns,
  setLastMapTurnId,
  setIsLoading,
}) {
  if (partialResponse != null) mapStream.ingestCoalesced(partialResponse);
  const parsed = partialResponse
    ? segmentsFromOrchestratorResponse(partialResponse, turnId)
    : { segments: [], mapRecords: undefined };
  const mapForUi =
    mergeMapRecordsByHexId(mapStream.getMerged(), parsed.mapRecords) ??
    mapStream.getMerged() ??
    parsed.mapRecords;

  if ((!parsed.segments.length && !mapForUi?.length) || streamAbort.signal.aborted) return;

  updateTurn(setTurns, turnId, (turn) => ({
    assistantText: '',
    assistantSegments: parsed.segments.length ? parsed.segments : (turn.assistantSegments ?? []),
    revealedSegmentIndex: parsed.segments.length
      ? parsed.segments.length - 1
      : turn.revealedSegmentIndex,
    mapRecords: mapForUi,
    mapColumns: mapStream.getColumns(),
    rawResponse: partialResponse ?? turn.rawResponse,
    _isStreaming: true,
  }));
  markMapTurn(mapForUi, turnId, setLastMapTurnId);
  if (parsed.segments.length) setIsLoading(false);
}

export async function consumeAssistantStream(streamBody, context) {
  const parsedEvents = [];
  const mapStream = createStreamingMapAccumulator(context.turnId);

  for await (const payload of iterateSseDataPayloads(streamBody)) {
    if (context.streamAbort.signal.aborted) break;
    await ingestPayloadEvents({ ...context, payload, parsedEvents, mapStream });
    const partialResponse = coalesceStreamEventsForUi(parsedEvents);
    publishPartialResponse({ ...context, partialResponse, mapStream });
  }

  return { parsedEvents, mapStream };
}

export function finalizeAssistantTurn({
  parsedEvents,
  mapStream,
  streamAbort,
  turnId,
  setTurns,
  setLastMapTurnId,
  setIsLoading,
}) {
  if (streamAbort.signal.aborted) {
    clearStreamingFlag(setTurns, turnId);
    return false;
  }

  const response = coalesceStreamEventsForUi(parsedEvents);
  if (response == null) {
    throw new Error(
      'Stream ended without a usable payload. Check API logs and the orchestrator response.'
    );
  }

  mapStream.ingestCoalesced(response);
  const { segments, mapRecords } = segmentsFromOrchestratorResponse(response, turnId);
  if (!segments.length) {
    setIsLoading(false);
    throw new Error('Empty response from assistant');
  }

  const finalMapRecords =
    mergeMapRecordsByHexId(mapStream.getMerged(), mapRecords) ??
    mapStream.getMerged() ??
    mapRecords;
  updateTurn(setTurns, turnId, () => ({
    assistantSegments: segments,
    revealedSegmentIndex: segments.length - 1,
    mapRecords: finalMapRecords,
    mapColumns: mapStream.getColumns(),
    rawResponse: response,
    _isStreaming: false,
  }));
  markMapTurn(finalMapRecords, turnId, setLastMapTurnId);
  return true;
}

export async function reportAssistantError(error, turnId, setTurns, loadThreads) {
  if (isAbortError(error)) {
    clearStreamingFlag(setTurns, turnId);
    return;
  }

  const errorMessage = error instanceof Error ? error.message : 'Failed to get response from API';
  const assistantApiError = error instanceof PortalApiError ? error.payload : undefined;
  const assistantApiStatus = error instanceof PortalApiError ? error.status : undefined;
  updateTurn(setTurns, turnId, () => ({
    assistantText: `Error: ${errorMessage}`,
    assistantApiError,
    assistantApiStatus,
    assistantSegments: undefined,
    revealedSegmentIndex: undefined,
  }));
  if (assistantApiStatus === 429 || assistantApiError?.error === 'quota_exceeded') {
    await loadThreads();
  }
}
