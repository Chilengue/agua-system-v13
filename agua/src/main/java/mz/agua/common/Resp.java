package mz.agua.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Formato de resposta compatível com o frontend existente:
 * sucesso → {"success": true, ...campos}, erro → {"success": false, "error": "..."}.
 */
public final class Resp {

    private Resp() {
    }

    /** Construtor fluente de mapas de resposta. */
    public static Builder ok() {
        return new Builder();
    }

    public static Map<String, Object> ok(String key, Object value) {
        return new Builder().with(key, value).build();
    }

    public static Map<String, Object> message(String message) {
        return new Builder().with("message", message).build();
    }

    public static ResponseEntity<Map<String, Object>> created(Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    public static Map<String, Object> error(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", false);
        m.put("error", error);
        return m;
    }

    public static final class Builder {
        private final Map<String, Object> map = new LinkedHashMap<>();

        private Builder() {
            map.put("success", true);
        }

        public Builder with(String key, Object value) {
            map.put(key, value);
            return this;
        }

        public Builder withAll(Map<String, ?> values) {
            map.putAll(values);
            return this;
        }

        public Map<String, Object> build() {
            return map;
        }
    }
}
