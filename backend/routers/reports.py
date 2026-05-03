"""Reporting endpoints backed by BigQuery.

Each route runs a single parameterised SQL query against the
``Our_data_warehouse`` star schema.

``shop_id`` is **optional**. When omitted, queries aggregate across **all
shops** in the franchise (franchise-wide reporting). When provided, results
are scoped to that location.

All endpoints also accept a ``[start_date, end_date]`` range. Dates are
inclusive ISO calendar dates evaluated against the ``sale_timestamp`` /
``event_timestamp`` columns.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from google.api_core.exceptions import GoogleAPIError

from ..bigquery_client import fq, run_query

router = APIRouter(prefix="/reports", tags=["reports"])


def _date_range(
    start_date: date | None,
    end_date: date | None,
    days_default: int = 30,
) -> tuple[date, date]:
    today = date.today()
    end = end_date or today
    start = start_date or (end - timedelta(days=days_default - 1))
    if start > end:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")
    return start, end


def _q(sql: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        return run_query(sql, params)
    except GoogleAPIError as exc:
        raise HTTPException(status_code=502, detail=f"BigQuery error: {exc.message}") from exc


def _shop_filter_sales(alias: str, shop_id: int | None) -> tuple[str, dict[str, Any]]:
    if shop_id is None:
        return "", {}
    return f" AND {alias}.shop_id = @shop_id", {"shop_id": shop_id}


def _shop_filter_wastage(alias: str, shop_id: int | None) -> tuple[str, dict[str, Any]]:
    if shop_id is None:
        return "", {}
    return f" AND {alias}.shop_id = @shop_id", {"shop_id": shop_id}


def _shop_filter_mkt(alias: str, shop_id: int | None) -> tuple[str, dict[str, Any]]:
    if shop_id is None:
        return "", {}
    return f" AND {alias}.shop_id = @shop_id", {"shop_id": shop_id}


@router.get("/kpis")
def kpis(
    shop_id: int | None = Query(None, gt=0),
    start_date: date | None = None,
    end_date: date | None = None,
):
    start, end = _date_range(start_date, end_date)
    sf, sp = _shop_filter_sales("s", shop_id)
    wf, wp = _shop_filter_wastage("w", shop_id)
    sales_sql = f"""
        SELECT
            COALESCE(SUM(gross_revenue), 0)    AS gross_revenue,
            COALESCE(SUM(net_revenue), 0)      AS net_revenue,
            COALESCE(SUM(net_profit), 0)       AS net_profit,
            COALESCE(SUM(total_cogs), 0)       AS total_cogs,
            COALESCE(SUM(tax_amount), 0)       AS total_tax,
            COUNT(DISTINCT sale_id)            AS transactions,
            SAFE_DIVIDE(SUM(net_revenue), COUNT(DISTINCT sale_id)) AS avg_basket
        FROM {fq('fact_sales_performance')} s
        WHERE DATE(s.sale_timestamp) BETWEEN @start AND @end
        {sf}
    """
    waste_sql = f"""
        SELECT
            COALESCE(SUM(total_loss_value), 0) AS total_loss_value,
            COUNT(*)                            AS wastage_events
        FROM {fq('fact_wastage_loss')} w
        WHERE DATE(w.event_timestamp) BETWEEN @start AND @end
        {wf}
    """
    params: dict[str, Any] = {"start": str(start), "end": str(end), **sp, **wp}
    sales = _q(sales_sql, params)[0]
    waste = _q(waste_sql, params)[0]
    return {**sales, **waste, "start_date": str(start), "end_date": str(end)}


@router.get("/revenue-trend")
def revenue_trend(
    shop_id: int | None = Query(None, gt=0),
    start_date: date | None = None,
    end_date: date | None = None,
):
    start, end = _date_range(start_date, end_date)
    ff, fp = _shop_filter_sales("f", shop_id)
    sql = f"""
        SELECT
            DATE(f.sale_timestamp)            AS sale_date,
            SUM(f.gross_revenue)              AS gross_revenue,
            SUM(f.net_revenue)                AS net_revenue,
            SUM(f.net_profit)                 AS net_profit,
            COUNT(DISTINCT f.sale_id)         AS transactions
        FROM {fq('fact_sales_performance')} f
        WHERE DATE(f.sale_timestamp) BETWEEN @start AND @end
        {ff}
        GROUP BY sale_date
        ORDER BY sale_date
    """
    rows = _q(sql, {"start": str(start), "end": str(end), **fp})
    for r in rows:
        r["sale_date"] = r["sale_date"].isoformat()
    return rows


@router.get("/sales-velocity")
def sales_velocity(
    shop_id: int | None = Query(None, gt=0),
    start_date: date | None = None,
    end_date: date | None = None,
):
    """Heatmap-friendly: revenue per (day_name, hour_of_day)."""
    start, end = _date_range(start_date, end_date)
    ff, fp = _shop_filter_sales("f", shop_id)
    sql = f"""
        SELECT
            f.day_name,
            f.hour_of_day,
            SUM(f.net_revenue)        AS net_revenue,
            COUNT(DISTINCT f.sale_id) AS transactions
        FROM {fq('fact_sales_performance')} f
        WHERE DATE(f.sale_timestamp) BETWEEN @start AND @end
        {ff}
        GROUP BY f.day_name, f.hour_of_day
        ORDER BY f.day_name, f.hour_of_day
    """
    return _q(sql, {"start": str(start), "end": str(end), **fp})


@router.get("/top-products")
def top_products(
    shop_id: int | None = Query(None, gt=0),
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(10, gt=0, le=50),
):
    start, end = _date_range(start_date, end_date)
    ff, fp = _shop_filter_sales("f", shop_id)
    sql = f"""
        SELECT
            f.product_id,
            p.product_name,
            p.category,
            COALESCE(NULLIF(TRIM(p.unit_measure), ''), '—') AS unit_measure,
            SUM(f.quantity)        AS units_sold,
            SUM(f.net_revenue)     AS net_revenue,
            SUM(f.net_profit)      AS net_profit
        FROM {fq('fact_sales_performance')} f
        LEFT JOIN {fq('dim_products')} p USING (product_id)
        WHERE DATE(f.sale_timestamp) BETWEEN @start AND @end
        {ff}
        GROUP BY f.product_id, p.product_name, p.category,
            COALESCE(NULLIF(TRIM(p.unit_measure), ''), '—')
        ORDER BY net_profit DESC
        LIMIT @limit
    """
    return _q(
        sql,
        {"start": str(start), "end": str(end), "limit": int(limit), **fp},
    )


@router.get("/category-mix")
def category_mix(
    shop_id: int | None = Query(None, gt=0),
    start_date: date | None = None,
    end_date: date | None = None,
):
    start, end = _date_range(start_date, end_date)
    ff, fp = _shop_filter_sales("f", shop_id)
    sql = f"""
        SELECT
            COALESCE(p.category, 'Uncategorised') AS category,
            SUM(f.net_revenue)                    AS net_revenue,
            SUM(f.net_profit)                     AS net_profit,
            SUM(f.quantity)                       AS units
        FROM {fq('fact_sales_performance')} f
        LEFT JOIN {fq('dim_products')} p USING (product_id)
        WHERE DATE(f.sale_timestamp) BETWEEN @start AND @end
        {ff}
        GROUP BY category
        ORDER BY net_revenue DESC
    """
    return _q(sql, {"start": str(start), "end": str(end), **fp})


@router.get("/wastage-summary")
def wastage_summary(
    shop_id: int | None = Query(None, gt=0),
    start_date: date | None = None,
    end_date: date | None = None,
):
    start, end = _date_range(start_date, end_date)
    wf, wp = _shop_filter_wastage("w", shop_id)
    by_reason_sql = f"""
        SELECT
            w.reason,
            SUM(w.total_loss_value)  AS total_loss_value,
            SUM(w.quantity_wasted)   AS quantity_wasted,
            COUNT(*)               AS events
        FROM {fq('fact_wastage_loss')} w
        WHERE DATE(w.event_timestamp) BETWEEN @start AND @end
        {wf}
        GROUP BY w.reason
        ORDER BY total_loss_value DESC
    """
    by_product_sql = f"""
        SELECT
            w.product_id,
            p.product_name,
            p.category,
            COALESCE(NULLIF(TRIM(p.unit_measure), ''), '—') AS unit_measure,
            SUM(w.total_loss_value) AS total_loss_value,
            SUM(w.quantity_wasted)  AS quantity_wasted,
            COUNT(*)                AS events
        FROM {fq('fact_wastage_loss')} w
        LEFT JOIN {fq('dim_products')} p USING (product_id)
        WHERE DATE(w.event_timestamp) BETWEEN @start AND @end
        {wf}
        GROUP BY w.product_id, p.product_name, p.category,
            COALESCE(NULLIF(TRIM(p.unit_measure), ''), '—')
        ORDER BY total_loss_value DESC
        LIMIT 10
    """
    params: dict[str, Any] = {"start": str(start), "end": str(end), **wp}
    return {
        "by_reason": _q(by_reason_sql, params),
        "by_product": _q(by_product_sql, params),
    }


@router.get("/staff-performance")
def staff_performance(
    shop_id: int | None = Query(None, gt=0),
    start_date: date | None = None,
    end_date: date | None = None,
):
    start, end = _date_range(start_date, end_date)
    ff, fp = _shop_filter_sales("f", shop_id)
    sql = f"""
        SELECT
            f.staff_id,
            s.staff_name,
            s.role,
            COUNT(DISTINCT f.sale_id)   AS transactions,
            SUM(f.net_revenue)          AS net_revenue,
            SUM(f.net_profit)           AS net_profit,
            SAFE_DIVIDE(SUM(f.net_revenue), COUNT(DISTINCT f.sale_id)) AS avg_basket
        FROM {fq('fact_sales_performance')} f
        LEFT JOIN {fq('dim_staff')} s ON s.id = f.staff_id
        WHERE DATE(f.sale_timestamp) BETWEEN @start AND @end
        {ff}
        GROUP BY f.staff_id, s.staff_name, s.role
        ORDER BY net_profit DESC
    """
    return _q(sql, {"start": str(start), "end": str(end), **fp})


@router.get("/promo-roi")
def promo_roi(
    shop_id: int | None = Query(None, gt=0),
    start_date: date | None = None,
    end_date: date | None = None,
):
    start, end = _date_range(start_date, end_date)
    mf, mp = _shop_filter_mkt("m", shop_id)
    sql = f"""
        SELECT
            m.promo_id,
            COALESCE(p.promo_name, 'Unknown')           AS promo_name,
            COALESCE(p.discount_percent, 0)             AS discount_percent,
            COUNT(DISTINCT m.sale_id)                   AS redemptions,
            SUM(m.quantity)                             AS units_sold,
            SUM(m.gross_revenue_pre_discount)           AS gross_pre_discount,
            SUM(m.discount_value_given)                 AS discount_given,
            SUM(m.gross_revenue_pre_discount - m.discount_value_given) AS net_revenue,
            SAFE_DIVIDE(
                SUM(m.discount_value_given),
                SUM(m.gross_revenue_pre_discount)
            )                                           AS discount_share
        FROM {fq('fact_marketing_impact')} m
        LEFT JOIN {fq('dim_promotions')} p ON p.promo_id = m.promo_id
        WHERE DATE(m.sale_timestamp) BETWEEN @start AND @end
        {mf}
        GROUP BY m.promo_id, p.promo_name, p.discount_percent
        ORDER BY net_revenue DESC
    """
    return _q(sql, {"start": str(start), "end": str(end), **mp})
