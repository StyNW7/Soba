# Tencent Cloud pilot deployment

This deployment runs one SOBA API process and PostgreSQL 17 on one Tencent
Cloud CVM. It is sized for the 2-core, 4 GiB pilot server. Set
`MAX_ACTIVE_SESSIONS=1` when the server has a 1 Mbps public network limit.

The initial private deployment uses the root `compose.yaml` and this resource
override. Both published ports bind to `127.0.0.1`. Do not publish the API until
HTTPS, OIDC, and the allowed web origin are configured.

```bash
cd /opt/soba/current
docker compose -f compose.yaml -f deploy/tencent/compose.override.yaml up -d --build
curl --fail http://127.0.0.1:8080/health/ready
```

Keep `/opt/soba/shared/.env` at mode `0600`. Do not copy it into Git. The current
release links its `.env` file to this shared file.

Install the backup service as root:

```bash
install -m 0750 deploy/tencent/soba-db-backup /usr/local/sbin/soba-db-backup
install -m 0644 deploy/tencent/soba-db-backup.service /etc/systemd/system/
install -m 0644 deploy/tencent/soba-db-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now soba-db-backup.timer
systemctl start soba-db-backup.service
```

Backups are custom-format PostgreSQL dumps in `/opt/soba/backups`, mode `0600`,
with a local retention period of seven days. A local backup does not protect
against disk or server loss. Copy encrypted backups to a separate approved
location and perform a restore test before production use.

The CVM also runs unrelated services. Check their status and current memory
before each deployment. Do not restart the server as part of a SOBA release.
