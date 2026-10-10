-- Custom SQL migration file, put your code below! --
CREATE TRIGGER audit_logs_no_replace BEFORE INSERT ON audit_logs
WHEN EXISTS (SELECT 1 FROM audit_logs WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END;
