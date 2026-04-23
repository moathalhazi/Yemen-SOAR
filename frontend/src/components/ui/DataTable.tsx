'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column<T> {
    key: string;
    header: string;
    sortable?: boolean;
    render?: (item: T) => React.ReactNode;
    width?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyExtractor: (item: T) => string;
    onRowClick?: (item: T) => void;
    pagination?: {
        page: number;
        pageSize: number;
        total: number;
        onPageChange: (page: number) => void;
    };
    isLoading?: boolean;
    emptyMessage?: string;
}

export default function DataTable<T extends object>({
    columns,
    data,
    keyExtractor,
    onRowClick,
    pagination,
    isLoading = false,
    emptyMessage = 'No data available',
}: DataTableProps<T>) {
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (column: Column<T>) => {
        if (!column.sortable) return;

        if (sortColumn === column.key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column.key);
            setSortDirection('asc');
        }
    };

    const sortedData = [...data].sort((a, b) => {
        if (!sortColumn) return 0;

        const aValue = (a as Record<string, unknown>)[sortColumn];
        const bValue = (b as Record<string, unknown>)[sortColumn];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = aValue < bValue ? -1 : 1;
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 0;

    return (
        <div className="bg-soar-bg-secondary rounded-xl border border-soar-border overflow-hidden">
            <div className="w-full overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-soar-card sticky top-0 z-10">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    onClick={() => handleSort(column)}
                                    className={cn(
                                        'text-left px-4 py-3 text-sm font-semibold text-slate-400',
                                        column.sortable && 'cursor-pointer hover:text-white select-none',
                                        column.width
                                    )}
                                >
                                    <div className="flex items-center gap-1">
                                        {column.header}
                                        {column.sortable && sortColumn === column.key && (
                                            sortDirection === 'asc' ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-12 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-soar-accent border-t-transparent rounded-full animate-spin" />
                                        <span className="text-slate-400">Loading...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            sortedData.map((item) => (
                                <tr
                                    key={keyExtractor(item)}
                                    onClick={() => onRowClick?.(item)}
                                    className={cn(
                                        'border-b border-soar-border/50 transition-colors',
                                        onRowClick && 'cursor-pointer hover:bg-soar-card/50'
                                    )}
                                >
                                    {columns.map((column) => (
                                        <td key={column.key} className="px-4 py-3 text-sm">
                                            {column.render
                                                ? column.render(item)
                                                : String((item as Record<string, unknown>)[column.key] ?? '-')}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-soar-border">
                    <p className="text-sm text-slate-400">
                        Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                        {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                        {pagination.total} results
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => pagination.onPageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="p-1 rounded hover:bg-soar-card disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm">
                            Page {pagination.page} of {totalPages}
                        </span>
                        <button
                            onClick={() => pagination.onPageChange(pagination.page + 1)}
                            disabled={pagination.page === totalPages}
                            className="p-1 rounded hover:bg-soar-card disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
