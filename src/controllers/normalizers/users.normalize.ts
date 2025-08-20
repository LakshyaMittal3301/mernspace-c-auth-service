import { SortField, SortOrder, ListUsersDto } from "../../dtos/user.dto";
import { ListUsersQuery } from "../../types/requests";

const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 10;
const LIMIT_MAX = 100;
const SORT_DEFAULT: SortField = "id";
const ORDER_DEFAULT: SortOrder = "desc";

export function normalizeListUsersQuery(q: ListUsersQuery): ListUsersDto {
    const page = q.page ?? PAGE_DEFAULT;
    const limit = Math.min(Math.max(q.limit ?? LIMIT_DEFAULT, 1), LIMIT_MAX);
    const sort: SortField = q.sort ?? SORT_DEFAULT;
    const order: SortOrder = q.order ?? ORDER_DEFAULT;

    const qstr = q.q?.trim() || undefined;
    const role = q.role;

    // Policy lives here, not in controller:

    return {
        pagination: { page, limit },
        sort: { field: sort, order },
        filters: { q: qstr, role },
    };
}
