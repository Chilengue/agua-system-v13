package mz.agua.common;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

/** Converte exceções em {success:false, error}. Nunca expõe detalhes internos ao utilizador. */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** Nome do índice/restrição única → mensagem clara. */
    private static final Map<String, String> UNIQUE = new LinkedHashMap<>();

    static {
        UNIQUE.put("uq_users_email", "Este email já está a ser usado por outro utilizador.");
        UNIQUE.put("users_username_user_key", "Este nome de utilizador já existe.");
        UNIQUE.put("uq_customers_document", "Já existe um cliente com este documento nesta empresa.");
        UNIQUE.put("uq_customers_phone", "Já existe um cliente com este telefone nesta empresa.");
        UNIQUE.put("uq_customers_1", "Código de cliente repetido. Tente novamente.");
        UNIQUE.put("uq_accounts_2", "Já existe uma conta com este número.");
        UNIQUE.put("uq_meters_active", "Este número de contador já está ativo noutra conta.");
        UNIQUE.put("uq_readings_meter_period", "Este contador já tem leitura neste período.");
        UNIQUE.put("readings_client_uuid_reading_key", "Leitura já recebida.");
        UNIQUE.put("payments_client_uuid_payment_key", "Pagamento já recebido.");
        UNIQUE.put("uq_invoices_reading", "Esta leitura já foi faturada.");
        UNIQUE.put("companies_code_company_key", "Código de empresa repetido. Tente novamente.");
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> api(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(Resp.error(e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst().map(f -> f.getDefaultMessage()).orElse("Dados inválidos.");
        return ResponseEntity.badRequest().body(Resp.error(msg));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> constraint(ConstraintViolationException e) {
        String msg = e.getConstraintViolations().stream().findFirst().map(v -> v.getMessage()).orElse("Dados inválidos.");
        return ResponseEntity.badRequest().body(Resp.error(msg));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class})
    public ResponseEntity<Map<String, Object>> badInput(Exception e) {
        return ResponseEntity.badRequest().body(Resp.error("Pedido inválido: verifique os valores enviados."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> illegal(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Resp.error(e.getMessage() == null ? "Pedido inválido." : e.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> integrity(DataIntegrityViolationException e) {
        String detail = String.valueOf(e.getMostSpecificCause().getMessage());
        log.warn("Violação de integridade: {}", detail);
        String msg = UNIQUE.entrySet().stream().filter(x -> detail.contains(x.getKey())).map(Map.Entry::getValue)
                .findFirst().orElse(detail.contains("foreign key")
                        ? "Não é possível: o registo está a ser usado noutro sítio."
                        : "Operação em conflito com dados existentes (registo duplicado).");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Resp.error(msg));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> denied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Resp.error("Sem permissão."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> method(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(Resp.error("Método não suportado."));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> notFound(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Resp.error("Recurso não encontrado."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> generic(Exception e) {
        log.error("Erro inesperado", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Resp.error("Erro interno do servidor. Tente novamente."));
    }
}
