# Warm Stay Database Schema

> Auto-generated from `PRAGMA table_info`. Update this file when schema changes.
> Last updated: 2026-06-07

---

## properties

숙소 정보. 12 rows.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK | 숙소 고유 ID |
| name | TEXT | NOT NULL | 숙소명 (예: "코지 강남 스튜디오") |
| address | TEXT | NOT NULL | 주소 |
| description | TEXT | | 숙소 설명 |
| photos | TEXT | | JSON array of photo URLs |
| platforms | TEXT | | JSON array of platform names (e.g. `["airbnb","booking"]`) |
| created_at | TEXT | | 생성일 |
| updated_at | TEXT | | 수정일 |
| tags | TEXT | | JSON array of tag strings (e.g. `["🏆 수익률 1위"]`) |

---

## bookings

예약 정보. 120 rows.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK | 예약 고유 ID |
| property_id | INTEGER | NOT NULL | FK → properties.id |
| guest_name | TEXT | NOT NULL | 게스트명 |
| check_in | TEXT | NOT NULL | 체크인 날짜 (YYYY-MM-DD) |
| check_out | TEXT | NOT NULL | 체크아웃 날짜 (YYYY-MM-DD) |
| status | TEXT | | `upcoming` \| `checked_in` \| `checked_out` \| `cancelled` |
| platform | TEXT | | `airbnb` \| `booking` \| `liveanywhere` |
| amount | INTEGER | | 결제 금액 (원) |
| settlement_date | TEXT | | 정산 예정일 (YYYY-MM-DD) |
| notes | TEXT | | 메모 |
| created_at | TEXT | | 생성일 |

---

## Example Queries

```sql
-- 특정 숙소 예약 조회
SELECT * FROM bookings WHERE property_id = 1 ORDER BY check_in DESC;

-- 월별 수익 집계
SELECT strftime('%m', check_in) as month, SUM(amount) as revenue, COUNT(*) as bookings
FROM bookings WHERE strftime('%Y', check_in) = '2026' AND status != 'cancelled'
GROUP BY strftime('%m', check_in) ORDER BY month;

-- 숙소별 예약 건수 랭킹
SELECT p.name, COUNT(*) as cnt FROM bookings b
JOIN properties p ON b.property_id = p.id
GROUP BY b.property_id ORDER BY cnt DESC;

-- 플랫폼별 수익
SELECT platform, SUM(amount) as revenue FROM bookings
WHERE status != 'cancelled' GROUP BY platform ORDER BY revenue DESC;
```
