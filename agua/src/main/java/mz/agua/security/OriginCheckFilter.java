package mz.agua.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Proteção CSRF para a API baseada em sessão: pedidos que alteram dados
 * (POST/PUT/PATCH/DELETE) só são aceites se o cabeçalho Origin (ou Referer)
 * for o próprio servidor ou uma origem configurada em app.allowed-origins.
 * Complementa o cookie SameSite=Lax.
 */
public class OriginCheckFilter extends OncePerRequestFilter {

    private static final Set<String> SAFE = Set.of("GET", "HEAD", "OPTIONS", "TRACE");
    private final Set<String> allowedOrigins;

    public OriginCheckFilter(Set<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (SAFE.contains(req.getMethod()) || !req.getRequestURI().startsWith("/api/")) {
            chain.doFilter(req, res);
            return;
        }
        String origin = req.getHeader("Origin");
        if (origin == null || origin.isBlank() || "null".equals(origin)) {
            String referer = req.getHeader("Referer");
            origin = referer == null ? null : originOf(referer);
        }
        // Clientes que não são browsers (curl, testes) não enviam Origin nem Referer.
        if (origin == null || sameHost(origin, req) || allowedOrigins.contains(origin)) {
            chain.doFilter(req, res);
            return;
        }
        res.setStatus(HttpServletResponse.SC_FORBIDDEN);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        res.getWriter().write("{\"success\":false,\"error\":\"Origem do pedido não permitida.\"}");
    }

    private static boolean sameHost(String origin, HttpServletRequest req) {
        try {
            URI u = URI.create(origin);
            String host = req.getHeader("Host");
            String originHost = u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "");
            return host != null && (host.equalsIgnoreCase(originHost) || host.equalsIgnoreCase(u.getHost()));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static String originOf(String url) {
        try {
            URI u = URI.create(url);
            if (u.getScheme() == null || u.getHost() == null) return null;
            return u.getScheme() + "://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "");
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
