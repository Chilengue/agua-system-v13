package mz.agua.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Consultas SQL guardadas em src/main/resources/sql/*.sql, cada uma marcada com "-- name: xxx".
 * Ficam fora do Java para poderem ser testadas diretamente no PostgreSQL (tools/test_sql.py).
 */
@Slf4j
@Component
public class SqlRegistry {

    private static final Pattern NAME = Pattern.compile("^--\\s*name:\\s*(\\S+)\\s*$", Pattern.MULTILINE);
    private final Map<String, String> queries = new HashMap<>();

    public SqlRegistry() throws IOException {
        Resource[] files = new PathMatchingResourcePatternResolver().getResources("classpath*:sql/*.sql");
        for (Resource r : files) {
            try (InputStream in = r.getInputStream()) {
                parse(new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        log.info("Consultas SQL carregadas: {}", queries.size());
    }

    private void parse(String text) {
        Matcher m = NAME.matcher(text);
        String name = null;
        int start = 0;
        while (m.find()) {
            if (name != null) put(name, text.substring(start, m.start()));
            name = m.group(1);
            start = m.end();
        }
        if (name != null) put(name, text.substring(start));
    }

    private void put(String name, String body) {
        String sql = body.trim();
        if (sql.endsWith(";")) sql = sql.substring(0, sql.length() - 1);
        queries.put(name, sql);
    }

    public String get(String name) {
        String sql = queries.get(name);
        if (sql == null) throw new IllegalStateException("Consulta SQL não encontrada: " + name);
        return sql;
    }
}
