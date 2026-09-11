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
