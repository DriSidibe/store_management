# Store Management

Gestion de magasin (produits, ventes, facturation, approvisionnement, caméras de
surveillance). Le projet est séparé en deux applications indépendantes :

- `backend/` — API REST Django + Django REST Framework (JWT)
- `frontend/` — application React (Vite)

## Backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # .venv\Scripts\activate sous cmd/PowerShell
pip install -r requirements.txt
cp .env.example .env            # puis ajuster SECRET_KEY etc.
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

L'API est servie sous `http://127.0.0.1:8000/api/`, l'admin Django sous `/admin/`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

L'application est servie sur `http://localhost:5173` et proxie `/api` et `/media`
vers le backend (voir `vite.config.js`).

## Build de production

```bash
cd frontend && npm run build
```

Le résultat (`frontend/dist`) est à servir en statique par Nginx (ou équivalent),
avec `/api/`, `/admin/`, `/media/` proxifiés vers Gunicorn/Django. Voir `deploy.sh`.

## Sauvegarde de la base de données

Chaque dimanche à 23 h (heure du serveur), le minuteur systemd
`store_management-backup.timer` (installé par `deploy.sh`) lance
`python manage.py backup_db` : copie cohérente de la base SQLite (sans arrêter
l'application), vérifiée puis compressée dans `backend/backups/`
(`db-AAAA-MM-JJ_HHMMSS.sqlite3.gz`), puis envoyée par `scp` vers `BACKUP_DEST`.
Les `BACKUP_KEEP` dernières (8 par défaut) sont gardées à chaque endroit. Si le
serveur était éteint à l'heure prévue, la sauvegarde part à son redémarrage.

Mise en place de l'envoi (une fois, sur le serveur) :

```bash
ssh-keygen -t ed25519 -N "" -C store-backup -f ~/.ssh/store_backup
ssh-copy-id -i ~/.ssh/store_backup.pub drissa@109.123.247.157
echo "BACKUP_DEST=drissa@109.123.247.157:backups/store_management" >> backend/.env
```

Lancer une sauvegarde à la main / voir la dernière exécution :

```bash
sudo systemctl start store_management-backup.service
sudo journalctl -u store_management-backup.service -n 20
systemctl list-timers store_management-backup.timer
```

Restaurer : arrêter le service (`sudo systemctl stop store_management`),
décompresser la sauvegarde choisie à la place de `backend/db.sqlite3`
(`gunzip -c db-....sqlite3.gz > backend/db.sqlite3`), puis redémarrer le service.
