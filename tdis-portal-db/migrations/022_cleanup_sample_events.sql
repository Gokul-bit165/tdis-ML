-- Description: Removes all sample test data events that were inserted for testing purposes
-- Impact: This migration will permanently delete all events with descriptions containing "(Test data)"

-- Delete only the sample test data events we inserted
DELETE FROM events_store
WHERE description LIKE '%(Test data)%'; 