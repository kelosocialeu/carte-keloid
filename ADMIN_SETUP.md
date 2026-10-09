# Administration de la carte NFC Kelo ID

Le panneau d’administration est accessible à `/admin`. Il n’utilise aucune base de données : chaque sauvegarde met à jour `countries.json` directement dans la branche `main` de ce dépôt GitHub. Vercel redéploie ensuite le site à partir du commit.

## Configuration initiale obligatoire dans Vercel

Dans **Vercel → projet `carte-keloid` → Settings → Environment Variables**, ajouter ces trois variables pour Production (et Preview/Development si souhaité) :

- `KELO_ADMIN_PASSWORD` : le code secret utilisé sur la page de connexion. Choisir au moins 12 caractères.
- `SESSION_SECRET` : une valeur aléatoire secrète d’au moins 32 caractères. Ne jamais la publier ni la committer.
- `GITHUB_TOKEN` : un jeton GitHub **Fine-grained personal access token** limité au dépôt `kelosocialeu/carte-keloid`, avec **Contents: Read and write**. Il sert uniquement à lire et modifier `countries.json` via l’API GitHub.

Ne pas placer ces valeurs dans les fichiers du dépôt et ne pas utiliser de préfixe `NEXT_PUBLIC_` ou `VITE_` : ce sont des secrets serveur.

Après avoir ajouté ou modifié les variables, lancer un nouveau déploiement Vercel (Redeploy) pour que les fonctions API les reçoivent.

## Utilisation

1. Ouvrir `/admin` et saisir `KELO_ADMIN_PASSWORD`.
2. Rechercher un pays.
3. Choisir le statut :
   - `green` : vérification NFC prise en charge ;
   - `red` : intégration à venir, avec date facultative ;
   - `gray` : documents sans NFC compatible.
4. Cliquer sur **Enregistrer dans le code**.

L’API valide la session côté serveur, vérifie les statuts et les dates, puis crée un commit GitHub. Le code admin n’est jamais envoyé au dépôt. Les cookies de session sont HttpOnly, Secure et SameSite=Strict.

## Configuration initiale de la carte

Par défaut, France (250), Espagne (724), Portugal (620), Italie (380), Pays-Bas (528) et Allemagne (276) sont verts. Les autres pays sont rouges tant qu’ils ne sont pas modifiés depuis le panneau d’administration.
