package mz.agua.web;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import mz.agua.security.CurrentUser;
import mz.agua.security.Roles;
import mz.agua.security.SessionUser;
import mz.agua.service.SetupService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;

import static java.util.Map.entry;

/** Páginas HTML (src/main/resources/pages), servidas só ao perfil certo; sem sessão → /login. */
@Controller
@RequiredArgsConstructor
public class PageController {

    private record Page(String file, Set<String> roles) {
    }

    private static final Set<String> MANAGER = Set.of(Roles.MANAGER);
    private static final Map<String, Page> PAGES = Map.ofEntries(
            entry("/admin", new Page("admin.html", Set.of(Roles.ADMIN))),
            entry("/dashboard", new Page("dashboard.html", MANAGER)),
            entry("/customers", new Page("customers.html", MANAGER)),
            entry("/readings", new Page("readings.html", MANAGER)),
            entry("/invoices", new Page("invoices.html", MANAGER)),
            entry("/cashier", new Page("cashier.html", MANAGER)),
            entry("/payments", new Page("payments.html", MANAGER)),
            entry("/statements", new Page("statements.html", MANAGER)),
            entry("/debtors", new Page("debtors.html", MANAGER)),
            entry("/reports", new Page("reports.html", MANAGER)),
            entry("/tariffs", new Page("tariffs.html", MANAGER)),
            entry("/team", new Page("team.html", MANAGER)),
            entry("/settings", new Page("settings.html", MANAGER)),
            entry("/messages", new Page("messages.html", MANAGER)),
            entry("/reader", new Page("reader.html", Set.of(Roles.READER, Roles.MANAGER))),
            entry("/portal", new Page("portal.html", Set.of(Roles.CUSTOMER))),
            entry("/print", new Page("print.html", Set.of(Roles.MANAGER, Roles.CUSTOMER, Roles.ADMIN))),
            entry("/change-password", new Page("change-password.html",
                    Set.of(Roles.ADMIN, Roles.MANAGER, Roles.READER, Roles.CUSTOMER)))
    );

    private final SetupService setup;

    @GetMapping("/")
    public ResponseEntity<Resource> root() {
        if (!setup.done()) return redirect("/setup");
        return redirect(CurrentUser.optional().map(SessionUser::home).orElse("/login"));
    }

    @GetMapping("/login")
    public ResponseEntity<Resource> login() {
        if (!setup.done()) return redirect("/setup");
        return html("login.html");
    }

    @GetMapping("/setup")
    public ResponseEntity<Resource> setupPage() {
        return setup.done() ? redirect("/login") : html("setup.html");
    }

    @GetMapping("/offline")
    public ResponseEntity<Resource> offline() {
        return html("offline.html");
    }

    @GetMapping({"/admin", "/dashboard", "/customers", "/readings", "/invoices", "/cashier", "/payments", "/statements",
            "/debtors", "/reports", "/tariffs", "/team", "/settings", "/messages", "/reader", "/portal", "/print", "/change-password"})
    public ResponseEntity<Resource> page(HttpServletRequest req) {
        SessionUser u = CurrentUser.optional().orElse(null);
        if (u == null) return redirect("/login");
        String path = req.getRequestURI();
        Page p = PAGES.get(path);
        if (p == null) return ResponseEntity.notFound().build();
        if (u.mustChangePassword() && !"/change-password".equals(path)) return redirect("/change-password");
        if (!p.roles().contains(u.role())) return redirect(u.home());
        return html(p.file());
    }

    private static ResponseEntity<Resource> html(String file) {
        return ResponseEntity.ok().contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .cacheControl(CacheControl.noCache()).body(new ClassPathResource("pages/" + file));
    }

    private static ResponseEntity<Resource> redirect(String to) {
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, to).build();
    }
}
