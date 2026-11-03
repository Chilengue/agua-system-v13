package mz.agua.security;

import mz.agua.common.ApiException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

/** Limite simples de tentativas por IP e por operação (janela fixa de 15 minutos). */
@Component
public class RateLimiter {

    private static final long WINDOW_MS = Duration.ofMinutes(15).toMillis();

    private record Bucket(long resetAt, int count) {
    }

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    public void check(String operacao, String ip, int max) {
        long now = System.currentTimeMillis();
        Bucket b = buckets.compute(operacao + ":" + ip, (k, old) ->
                (old == null || now > old.resetAt()) ? new Bucket(now + WINDOW_MS, 1) : new Bucket(old.resetAt(), old.count() + 1));
        if (b.count() > max) {
            long secs = Math.max(1, (b.resetAt() - now) / 1000);
            throw ApiException.tooManyRequests("Demasiadas tentativas. Tente novamente em " + secs + "s.");
        }
    }

    @Scheduled(fixedDelay = 600_000)
    public void limpar() {
        long now = System.currentTimeMillis();
        buckets.entrySet().removeIf(e -> now > e.getValue().resetAt());
    }
}
