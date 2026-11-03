package mz.agua.common;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Execução das consultas nomeadas (listas, painéis e relatórios). Linhas devolvidas como mapas JSON. */
@Component
@RequiredArgsConstructor
public class Db {

    private final NamedParameterJdbcTemplate jdbc;
    private final SqlRegistry sql;

    public List<Map<String, Object>> list(String name, Map<String, ?> params) {
        return jdbc.queryForList(sql.get(name), params);
    }

    public Map<String, Object> one(String name, Map<String, ?> params) {
        List<Map<String, Object>> rows = list(name, params);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> require(String name, Map<String, ?> params, String notFound) {
        Map<String, Object> row = one(name, params);
        if (row == null) throw ApiException.notFound(notFound);
        return row;
    }

    /** Lista paginada. A consulta tem "COUNT(*) OVER () AS total_rows" e usa :limit / :offset. */
    public Map<String, Object> page(String name, Q params) {
        List<Map<String, Object>> rows = list(name, params.map());
        long total = 0;
        if (!rows.isEmpty() && rows.get(0).get("total_rows") instanceof Number n) total = n.longValue();
        rows.forEach(r -> r.remove("total_rows"));
        int size = params.size();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        out.put("items", rows);
        out.put("total", total);
        out.put("page", params.page());
        out.put("size", size);
        out.put("pages", size == 0 ? 1 : Math.max(1, (total + size - 1) / size));
        return out;
    }

    public int update(String sqlText, Map<String, ?> params) {
        return jdbc.update(sqlText, params);
    }

    public Long longValue(String sqlText, Map<String, ?> params) {
        return jdbc.queryForObject(sqlText, params, Long.class);
    }

    public static BigDecimal dec(Map<String, Object> row, String key) {
        Object v = row == null ? null : row.get(key);
        if (v instanceof BigDecimal b) return b;
        if (v instanceof Number n) return new BigDecimal(n.toString());
        return BigDecimal.ZERO;
    }

    public static Long lng(Map<String, Object> row, String key) {
        Object v = row == null ? null : row.get(key);
        return v instanceof Number n ? n.longValue() : null;
    }

    public static String str(Map<String, Object> row, String key) {
        Object v = row == null ? null : row.get(key);
        return v == null ? null : v.toString();
    }
}
