// Spring Data Page<T> 직렬화 형태
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // 현재 페이지 (0-based)
  size: number;
  first: boolean;
  last: boolean;
}

export interface PageParams {
  page?: number; // 0-based
  size?: number;
  sort?: string; // 예: "createdAt,desc"
}
