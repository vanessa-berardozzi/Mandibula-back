# Mandibula Backend API

Ce dépôt contient le backend Express.js de Mandibula, conçu pour servir uniquement une API (le front est dans un repo séparé).

## Installation

```bash
npm install
```

## Lancement du serveur

- En mode normal :
  ```bash
  npm start
  ```
- En mode développement (rechargement auto) :
  ```bash
  npm run dev
  ```

Le serveur écoute par défaut sur http://localhost:5000 (modifiable via la variable d'environnement `PORT`).

## Structure du projet

- `index.js` : point d'entrée, lance le serveur.
- `server.js` : configuration Express, middlewares, routes, gestion des erreurs.
- `routes/` : routes de l'API.
- `node_modules/` : dépendances (non versionnées).

## Variables d'environnement

Créer un fichier `.env` à la racine si besoin, par exemple :
```
PORT=3002
```

## Bonnes pratiques
- Pas de moteur de vues ni de dossier public : ce backend ne sert que des routes API.
- Les dépendances front sont gérées dans un autre dépôt.

## Auteur
- [Ton nom ou équipe]
