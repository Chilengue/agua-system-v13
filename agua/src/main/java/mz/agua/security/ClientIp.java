package mz.agua.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * IP do cliente. Usa o endereço remoto; se a aplicação estiver atrás de um proxy,
 * configure server.forward-headers-strategy=framework para o Spring o resolver.
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String of(HttpServletRequest request) {
        return request == null ? "unknown" : request.getRemoteAddr();
    }
}
