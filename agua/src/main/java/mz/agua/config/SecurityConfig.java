package mz.agua.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import mz.agua.security.OriginCheckFilter;
import mz.agua.security.SessionRevalidationFilter;
import mz.agua.service.AuthService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Sessão HTTP (cookie AGUA_SID). Páginas, CSS/JS e o service worker são públicos para a aplicação
 * abrir mesmo sem rede; todos os dados (/api/**) exigem sessão, exceto login, registo e recuperação.
 * Cada página verifica o perfil no PageController e cada serviço volta a verificar (CurrentUser).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String[] PUBLIC = {
            "/", "/login", "/setup", "/offline", "/error", "/favicon.ico", "/actuator/health",
            "/css/**", "/js/**", "/img/**", "/vendor/**", "/manifest.webmanifest", "/sw.js",
            "/api/auth/login", "/api/auth/logout", "/api/auth/session", "/api/auth/forgot", "/api/auth/reset",
            "/api/auth/register-company", "/api/public/**", "/api/setup/**"
    };

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, AppProperties props, SecurityContextRepository repo,
                                           AuthService auth) throws Exception {
        http.csrf(c -> c.disable())
                .securityContext(sc -> sc.securityContextRepository(repo))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(PUBLIC).permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> deny(req, res, 401, "Sessão expirada. Entre novamente."))
                        .accessDeniedHandler((req, res, ex) -> deny(req, res, 403, "Sem permissão.")))
                .formLogin(f -> f.disable())
                .httpBasic(b -> b.disable())
                .logout(l -> l.disable())
                .headers(h -> h.frameOptions(f -> f.sameOrigin()))
                .addFilterBefore(new OriginCheckFilter(props.allowedOriginSet()), UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(new SessionRevalidationFilter(auth), AnonymousAuthenticationFilter.class);
        return http.build();
    }

    private static void deny(HttpServletRequest req, HttpServletResponse res, int status, String msg) throws IOException {
        if (req.getRequestURI().startsWith("/api/")) {
            res.setStatus(status);
            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
            res.setCharacterEncoding(StandardCharsets.UTF_8.name());
            res.getWriter().write("{\"success\":false,\"error\":\"" + msg + "\"}");
        } else {
            res.sendRedirect("/login");
        }
    }
}
