import { NextResponse } from 'next/server';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export function apiSuccess<T>(
  message: string,
  data?: T,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      message,
      ...(data !== undefined ? { data } : {}),
    },
    { status }
  );
}

export function apiError(
  message: string,
  status: number = 400
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

export function formatDate(dateInput: Date | string | number): string {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
