# Shares Viewer

Shares Viewer est une application de visualisation en temps réel des shares envoyés par des mineurs Bitcoin.

L’objectif est de rendre visible et compréhensible le travail des mineurs sur un pool, avec une approche combinant temps réel et gamification :

* Suivi des performances par worker
* Classement basé sur les best shares
* Progression (XP, niveaux, streak)
* Historique des rounds

---

## Fonctionnement global

Le projet repose sur trois briques :

* **Un serveur de shares (externe)**
  Basé sur hash-contenders-backend
  Il fournit les shares en temps réel via WebSocket

* **Backend (NestJS)**

  * Agrège les shares
  * Gère les rounds
  * Stocke les statistiques (PostgreSQL)
  * Utilise Redis pour l’état live

* **Frontend (Next.js)**

  * Affiche les workers
  * Met à jour les données en temps réel
  * Interface gamifiée

---

## Installation

### 1. Configuration des variables d’environnement

Créer les fichiers `.env` suivants.

### Frontend

```env
NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_WS_URL=http://localhost:3001
```

### Backend

```env
PORT=3001

SHARES_WS_URL=wss://...
SHARES_WS_TOKEN="..."

DATABASE_URL="postgresql://postgres:postgres@postgres:5432/shares_viewer?schema=public"

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
```

Notes :

* `SHARES_WS_URL` doit pointer vers le serveur de shares
* `SHARES_WS_TOKEN` dépend de votre configuration
* `postgres` et `redis` correspondent aux services Docker

---

### 2. Lancer les services (PostgreSQL et Redis)

```bash
docker compose up -d
```

---

### 3. Lancer le backend

```bash
cd apps/backend

npm install
npx prisma generate
npx prisma migrate dev

npm run dev
```

---

### 4. Lancer le frontend

```bash
cd apps/frontend

npm install
npm run dev
```

---

## Accès

* Frontend : [http://localhost:3000](http://localhost:3000)
* Backend : [http://localhost:3001](http://localhost:3001)

---

## Réinitialisation de la base de données

```bash
cd apps/backend
npx prisma migrate reset
```

---

## Concept technique

Le backend reçoit les shares en temps réel et :

* détecte les changements de round
* agrège les performances par worker
* maintient un état live en Redis
* archive les rounds en base de données

Le frontend consomme :

* un état live (`/live`)
* un historique (`/history`)
* des événements WebSocket

---

## Dépendance externe

Ce projet fonctionne en synergie avec :

hash-contenders-backend

Ce service fournit les shares en temps réel depuis CKPool. Sans lui, aucune donnée ne sera disponible.

---

## Auteur

Projet réalisé par **itrider-gh**
