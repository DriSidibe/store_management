from django.core.management.base import BaseCommand

from camera.models import RecordingSettings
from camera.retention import purge
from store.models import ActivityLog


class Command(BaseCommand):
    help = "Deletes camera recordings older than the retention period set in the app (run nightly)."

    def handle(self, *args, **options):
        retention = RecordingSettings.load().retention_days
        removed = purge(retention)
        for day, path, size in removed:
            self.stdout.write(f"supprimé {path} ({size / 1e6:.0f} Mo)")
        freed = sum(size for _, _, size in removed)
        self.stdout.write(f"Conservation {retention} jours : {len(removed)} dossier(s) supprimé(s), {freed / 1e9:.1f} Go libérés.")
        if removed:
            days = sorted({day for day, _, _ in removed})
            ActivityLog.objects.create(
                user=None, action='deleted', model_name='Recording',
                object_repr=f"Vidéos du {days[0]:%d/%m/%Y} au {days[-1]:%d/%m/%Y}",
                details=f"Conservation {retention} jours, {freed / 1e9:.1f} Go libérés",
            )
