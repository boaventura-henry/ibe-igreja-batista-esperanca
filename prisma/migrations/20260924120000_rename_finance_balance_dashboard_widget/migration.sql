UPDATE "DashboardWidget"
SET
  "title" = 'Saldo geral',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'finance.balance'
  AND "title" IS DISTINCT FROM 'Saldo geral';
