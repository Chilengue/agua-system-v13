package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.Codes;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Year;
import java.util.Map;

/**
 * Numeração sem colisões, por empresa: um único UPSERT atómico no PostgreSQL
 * (duas caixas a receber ao mesmo tempo nunca recebem o mesmo número).
 */
@Service
@RequiredArgsConstructor
public class SequenceService {

    private static final String NEXT = """
            INSERT INTO sequences (id_company_sequence, name_sequence, year_sequence, value_sequence, created_at, updated_at)
            VALUES (:cid, :name, :year, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (id_company_sequence, name_sequence, year_sequence)
            DO UPDATE SET value_sequence = sequences.value_sequence + 1, updated_at = CURRENT_TIMESTAMP
            RETURNING value_sequence""";

    private final NamedParameterJdbcTemplate jdbc;

    public long next(Long companyId, String name, int year) {
        Long v = jdbc.queryForObject(NEXT, Map.of("cid", companyId, "name", name, "year", year), Long.class);
        return v == null ? 1 : v;
    }

    /** FT-2026-000001 */
    public String invoiceNumber(Long companyId, String prefix) {
        int y = Year.now().getValue();
        return prefix + "-" + y + "-" + String.format("%06d", next(companyId, "invoice", y));
    }

    /** RC-2026-000001 */
    public String receiptNumber(Long companyId, String prefix) {
        int y = Year.now().getValue();
        return prefix + "-" + y + "-" + String.format("%06d", next(companyId, "receipt", y));
    }

    /** CLI-VJA3-00001 (login do cliente no portal) */
    public String customerCode(Long companyId, String companyCode) {
        return "CLI-" + Codes.companyTag(companyCode) + "-" + String.format("%05d", next(companyId, "customer", 0));
    }

    /** CT-VJA3-00001 (número da conta/contrato) */
    public String accountNumber(Long companyId, String companyCode) {
        return "CT-" + Codes.companyTag(companyCode) + "-" + String.format("%05d", next(companyId, "account", 0));
    }

    /** MED-VJA3-01 (login do mediador) */
    public String readerUsername(Long companyId, String companyCode) {
        return "MED-" + Codes.companyTag(companyCode) + "-" + String.format("%02d", next(companyId, "reader", 0));
    }
}
