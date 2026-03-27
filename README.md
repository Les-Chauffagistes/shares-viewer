# Shares Viewer

## Variables d'environnement

### Frontend
```env
NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_WS_URL=http://localhost:3001
````

### Backend

```env
PORT=3001

SHARES_WS_URL=
SHARES_WS_TOKEN=""

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shares_viewer?schema=public"

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
```

## Lancer les services

```bash
docker compose up -d
```

## Lancer le backend

```bash
cd apps/backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## reset la db

```bash
npx prisma migrate reset
```

## Lancer le frontend

```bash
cd apps/frontend
npm install
npm run dev
```

## Accès

* Frontend : [http://localhost:3000](http://localhost:3000)
* Backend : [http://localhost:3001](http://localhost:3001)

```

