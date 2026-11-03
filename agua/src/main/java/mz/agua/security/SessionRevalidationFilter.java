package mz.agua.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import mz.agua.service.AuthService;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * A cada minuto confirma que a conta e a empresa continuam ativas (suspender tem efeito imediato).
 * Registado dentro da cadeia do Spring Security (SecurityConfig), depois da sessão ser lida.
 */
@RequiredArgsConstructor
public class SessionRevalidationFilter extends OncePerRequestFilter {

    private static final String ATTR = "agua.lastCheck";
    private final AuthService auth;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        SessionUser u = CurrentUser.optional().orElse(null);
        HttpSession s = req.getSession(false);
        if (u != null && s != null) {
            Object last = s.getAttribute(ATTR);
            long now = System.currentTimeMillis();
            if (!(last instanceof Long l) || now - l > 60_000) {
                if (!auth.stillValid(u)) {
                    s.invalidate();
                    SecurityContextHolder.clearContext();
                    if (req.getRequestURI().startsWith("/api/")) {
                        res.setStatus(401);
                        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
                        res.getWriter().write("{\"success\":false,\"error\":\"Sessão terminada: conta ou empresa inativa.\"}");
                    } else {
                        res.sendRedirect("/login");
                    }
                    return;
                }
                s.setAttribute(ATTR, now);
            }
        }
        chain.doFilter(req, res);
    }
}
