import datetime
import gzip
import shutil
import sqlite3
import subprocess
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from store.models import ActivityLog

PREFIX = 'db-'
SUFFIX = '.sqlite3.gz'


class Command(BaseCommand):
    help = (
        "Sauvegarde la base de données : copie cohérente (API de sauvegarde SQLite, "
        "sans arrêter l'application), vérifiée puis compressée dans BACKUP_DIR, "
        "envoyée vers BACKUP_DEST (scp) si configuré. Garde les BACKUP_KEEP "
        "dernières sauvegardes à chaque endroit (lancée chaque semaine)."
    )

    def handle(self, *args, **options):
        backup_dir = Path(settings.BACKUP_DIR)
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')
        copy = backup_dir / f'{PREFIX}{stamp}.sqlite3'
        archive = backup_dir / f'{PREFIX}{stamp}{SUFFIX}'

        self._copy_database(copy)
        with open(copy, 'rb') as src, gzip.open(archive, 'wb') as dst:
            shutil.copyfileobj(src, dst)
        copy.unlink()
        self.stdout.write(f"Sauvegarde locale : {archive} ({archive.stat().st_size / 1e3:.0f} Ko)")
        self._prune_local(backup_dir)

        destination = settings.BACKUP_DEST
        if destination:
            self._send(archive, destination)
            self.stdout.write(f"Envoyée vers {destination}")

        ActivityLog.objects.create(
            action='backup', model_name='Database', object_repr=archive.name,
            details=f"envoyée vers {destination}" if destination else "copie locale uniquement",
        )

    @staticmethod
    def _copy_database(target):
        """Online copy through SQLite's backup API (consistent even while the
        app writes), refused if the copy is not intact."""
        connection.ensure_connection()
        dst = sqlite3.connect(target)
        try:
            connection.connection.backup(dst)
            result = dst.execute('PRAGMA integrity_check').fetchone()[0]
        finally:
            dst.close()
        if result != 'ok':
            target.unlink()
            raise CommandError(f"Copie de la base corrompue ({result}) : sauvegarde abandonnée.")

    @staticmethod
    def _prune_local(backup_dir):
        archives = sorted(backup_dir.glob(f'{PREFIX}*{SUFFIX}'), reverse=True)
        for old in archives[settings.BACKUP_KEEP:]:
            old.unlink()

    def _send(self, archive, destination):
        host, _, remote_dir = destination.partition(':')
        remote_dir = remote_dir or '.'
        ssh_options = [
            '-i', settings.BACKUP_SSH_KEY, '-o', 'BatchMode=yes',
            '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=30',
        ]
        keep_from = settings.BACKUP_KEEP + 1
        self._run(['ssh', *ssh_options, host, f"mkdir -p '{remote_dir}'"])
        self._run(['scp', '-q', *ssh_options, str(archive), f"{host}:{remote_dir}/"])
        self._run(['ssh', *ssh_options, host,
                   f"cd '{remote_dir}' && ls -1t {PREFIX}*{SUFFIX} | tail -n +{keep_from} | xargs -r rm --"])

    @staticmethod
    def _run(command):
        result = subprocess.run(command, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise CommandError(f"Échec de l'envoi ({' '.join(command[:1])}) : {result.stderr.strip()}")
