import React from 'react';
import PropTypes from 'prop-types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function DataTable({
  columns,
  rows,
  loading = false,
  empty = 'No records found.',
  onRowClick,
  renderExpandedRow,
}) {
  const hasRows = rows.length > 0;

  const handleKeyDown = (event, row) => {
    if (!onRowClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-[#CBD1D3] bg-white">
      <table className="w-full min-w-full border-collapse text-sm text-[#324755]">
        <thead className="bg-[#F0F3F4]">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="border-b border-[#CBD1D3] px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#334755]/75"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr
                  key={`skeleton-${rowIndex}`}
                  className="border-b border-[#CBD1D3] last:border-b-0"
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      <Skeleton className="h-5 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))
            : null}

          {!loading && !hasRows ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm font-medium text-[#334755]/70"
              >
                {empty}
              </td>
            </tr>
          ) : null}

          {!loading && hasRows
            ? rows.map((row, rowIndex) => {
                const expandedRow = renderExpandedRow ? renderExpandedRow(row) : null;
                return (
                  <React.Fragment key={row.id ?? row.uuid ?? rowIndex}>
                    <tr
                      className={cn(
                        'border-b border-[#CBD1D3] last:border-b-0',
                        onRowClick ? 'cursor-pointer hover:bg-[#F0F3F4]/70' : ''
                      )}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? (event) => handleKeyDown(event, row) : undefined}
                    >
                      {columns.map((column) => {
                        const value = row[column.key];
                        return (
                          <td key={column.key} className="px-4 py-3 align-top text-[#334755]">
                            {column.render ? column.render(value, row) : (value ?? 'N/A')}
                          </td>
                        );
                      })}
                    </tr>
                    {expandedRow ? (
                      <tr className="border-b border-[#CBD1D3] last:border-b-0">
                        <td colSpan={columns.length} className="bg-[#F0F3F4] px-4 py-3">
                          {expandedRow}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            : null}
        </tbody>
      </table>
    </div>
  );
}

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      render: PropTypes.func,
    })
  ).isRequired,
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool,
  empty: PropTypes.string,
  onRowClick: PropTypes.func,
  renderExpandedRow: PropTypes.func,
};

export default DataTable;
