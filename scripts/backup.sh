#!/usr/bin/env bash
set -euo pipefail

data_dir="${COMPASS_DATA_DIR:-/data}"
backup_dir="${COMPASS_BACKUP_DIR:-/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
work_dir="${backup_dir}/.compass-${timestamp}"
archive="${backup_dir}/compass-${timestamp}.tar.gz"

mkdir -p "${work_dir}" "${backup_dir}"
sqlite3 "${data_dir}/compass.db" ".timeout 30000" ".backup '${work_dir}/compass.db'"
if [[ -d "${data_dir}/attachments" ]]; then
  cp -a "${data_dir}/attachments" "${work_dir}/attachments"
fi
printf '%s\n' "${timestamp}" > "${work_dir}/created-at.txt"
tar -C "${work_dir}" -czf "${archive}" .
rm -rf "${work_dir}"
printf 'Backup created: %s\n' "${archive}"
