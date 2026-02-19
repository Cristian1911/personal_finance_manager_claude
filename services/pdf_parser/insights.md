I was testing the new parsers import, but they are missing some data.
## Falabella credit card: 
- payment_due_date has the text "Paga antes del" and then a breakline with "20 FEB 2026"
- doesn't have a global interest rate. Instead, it has the interest rate BY TRANSACTION under "Tasa efectiva anual"
- Has interest amount = 46.240,30 after "Intereses corrientes:"


## Davivienda loan:
- Anual interest rate is next to "Tasa Interés Cte.Cobrada Periodo"

## Banco popular credit card:
- previous amount after "Saldo anterior" = 13,101,891.00
- month interest amount "+ Intereses corrientes" = 195,966.00
- Just like falabella, this credit card has interest rates per transaction. Under "Tasa efectiva"

## Banco de bogota:
### Credit card:
- This too has interest rates per transaction. Under "Tasa Original Efectiva Anual"
- Interest amount = 24,312 "+ Intereses corrientes (1)"

### Loan:
- Initial amount: "MONTO APROBADO"= 40,000,000.00
- Interest rate: "TASA PACTADA E.A." = 13.09
- In arrears interest rate: "TASA INTERÉS MORA E.A." = 19.65
- Interest amount = "+ INTERESES CORRIENTES" = 345,501.67

---

Finally, I see every credit statement has total quotas, and current cuota. This could give loans some extra insight