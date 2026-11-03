package mz.agua.common;

import java.security.SecureRandom;

/** Geração de códigos e senhas aleatórias legíveis (sem caracteres ambíguos como 0/O e 1/I). */
public final class Codes {

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Codes() {
    }

    public static String random(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return sb.toString();
    }

    /** Código de empresa: AGUA-XXXX-XXXX (também é o login do gestor). */
    public static String companyCode() {
        return "AGUA-" + random(4) + "-" + random(4);
    }

    /** Senha temporária: 8 caracteres, fácil de ditar ao cliente. */
    public static String tempPassword() {
        return random(4) + "-" + random(4);
    }

    /** Parte central do código da empresa (AGUA-VJA3-VGRA → VJA3), usada nos códigos de clientes e mediadores. */
    public static String companyTag(String companyCode) {
        String[] p = companyCode == null ? new String[0] : companyCode.split("-");
        return p.length >= 2 ? p[1] : "XXXX";
    }

    /** Código numérico de 6 dígitos para recuperação de senha. */
    public static String numeric(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) sb.append(RANDOM.nextInt(10));
        return sb.toString();
    }
}
