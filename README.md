# FORGE — carnet de musculation privé

Application Next.js / TypeScript, en français, conçue pour un petit groupe d’amis. La mise à jour du cahier des charges prévaut : **comptes créés par le propriétaire, connexion par identifiant, aucune inscription publique, aucune récupération par email**.

Le dépôt contient le code applicatif, les migrations PostgreSQL, 388 fiches d’exercice (62 mouvements généraux, 269 fiches Technogym et 57 variantes de barres, pupitres, prises, tractions et dips), des tests unitaires, des tests SQL et les parcours Playwright. Aucune performance fictive n’est injectée dans l’application. Sans configuration Supabase, seule la connexion et son message de mise en route sont disponibles.

## Démarrer

Prérequis : Node.js 24 LTS et npm. Depuis ce dossier :

```powershell
npm ci
Copy-Item .env.example .env.local
# Renseigner .env.local selon la section suivante.
npm run dev
```

Ouvrir [l’application locale](http://127.0.0.1:3000). Le mode développement utilise Webpack : le Turbopack fourni avec cette version a rencontré une erreur interne de processus CSS sur ce poste Windows. Le build Webpack a été exécuté avec succès.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

`npm start` sert le build de production sur la même adresse. Arrêter le serveur de développement avant de démarrer celui de production. Aucun mode de démonstration ni accès de secours ne contourne l’authentification.

## Configurer Supabase

1. Créer un **nouveau projet Supabase** et conserver son mot de passe de base hors du dépôt. Les ressources créées sur le compte sont décrites dans `docs/PROVISIONING.md`.
2. Dans **Authentication → Sign In / Providers**, conserver le fournisseur email/mot de passe, désactiver **Allow new users to sign up**, les connexions anonymes et les fournisseurs non utilisés. **Confirm email** peut rester activé : les utilisateurs sont provisionnés exclusivement par l’API admin avec `email_confirm: true`, sans envoi de confirmation. C’est la configuration du projet hébergé FORGE.
3. Définir une longueur minimale de mot de passe de 12 caractères. Conserver les protections Supabase contre les tentatives répétées. Le fichier `supabase/config.toml` applique ces réglages pour une stack locale. Il **ne configure pas automatiquement votre projet hébergé**.
4. Configurer l’URL du site, d’abord `http://127.0.0.1:3000`, puis votre URL Vercel. Conserver des JWT courts (900 secondes dans la configuration locale). Désactiver les notifications email de changement de mot de passe si elles sont activées sur le projet : l’application n’utilise aucun flux email.
5. Appliquer les fichiers de `supabase/migrations/` dans l’ordre de leur nom sur le projet neuf, puis `supabase/seed.sql`. Chaque migration s’applique une fois ; le seed peut être réexécuté sans doublons. Pour une gestion versionnée via la CLI, consulter `npx supabase link --help` puis `npx supabase db push --help` avant de lier et pousser vers le bon projet. Ne pas mélanger une application manuelle et la CLI sans réconcilier l’historique des migrations.
6. Vérifier que le schéma `public` est exposé à la Data API. Les droits `GRANT` et toutes les politiques RLS sont dans la migration. Le schéma `private` ne doit jamais être ajouté aux schémas exposés.
7. Remplir `.env.local` :

| Variable | Valeur à fournir |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de votre projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique/publishable du projet |
| `SUPABASE_SECRET_KEY` | Clé secrète serveur Supabase ; une clé historique `service_role` est également utilisable |
| `AUTH_IDENTITY_DOMAIN` | Domaine technique **que vous contrôlez**, réservé à ces comptes |
| `LOGIN_RATE_SECRET` | Secret aléatoire d’au moins 32 caractères |
| `APP_ORIGIN` | Origine exacte, initialement `http://127.0.0.1:3000` |

Seules les deux variables `NEXT_PUBLIC_` sont publiques. Aucune clé secrète ne doit avoir ce préfixe. `.env.local` est ignoré par Git. Un secret de limitation peut être généré localement avec `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, puis copié dans votre fichier de configuration.

### Identités techniques sans boîte mail

Supabase Auth demande une identité email ou téléphone pour un mot de passe. Ici, chaque compte reçoit une identité technique aléatoire `UUID@AUTH_IDENTITY_DOMAIN`, sur **votre domaine réservé à cet usage**. Ce n’est pas l’adresse personnelle d’un ami, et aucune boîte individuelle n’est nécessaire au fonctionnement quotidien. Ne renseignez pas le domaine d’un tiers, ni une adresse personnelle inventée. Le script refuse l’absence de domaine ; il ne fournit aucune valeur fictive par défaut.

La correspondance identifiant → utilisateur → identité technique est stockée dans `private.login_identities`. La page de connexion transmet uniquement l’identifiant et le mot de passe au serveur. Celui-ci résout l’identité via une RPC accessible à la seule clé serveur et utilise Supabase Auth pour vérifier le mot de passe. Les mots de passe ne sont jamais stockés dans les tables de l’application.

Les RPC administratives sont volontairement `SECURITY DEFINER`, avec `search_path` vide et droit d’exécution limité à `service_role`. Les RPC de programmes/séances sont `SECURITY INVOKER` et respectent les RLS. Aucun rôle d’administrateur n’est attribué via des métadonnées modifiables par l’utilisateur.

### Créer et réinitialiser des comptes

Dans un terminal interactif de confiance, avec `.env.local` configuré :

```powershell
npm run admin -- create jean "Jean"
npm run admin -- create ami_01 "Mon ami"
npm run admin -- reset ami_01
```

Le mot de passe est demandé **sans affichage** et sans argument de ligne de commande. Identifiants : 3 à 32 caractères, lettres minuscules, chiffres, point, tiret ou soulignement. Les scripts créent aussi le profil et les préférences ; la création est compensée si une étape échoue. Créer un utilisateur seulement dans le panneau Auth ne suffit pas à établir la correspondance d’identifiant.

Une réinitialisation admin ne garantit pas la révocation immédiate des JWT déjà émis. En cas de compromission, révoquer les sessions dans l’administration Supabase ; les JWT courts limitent leur durée de vie. La suppression depuis l’application demande le mot de passe actuel, `SUPPRIMER`, puis une confirmation. Elle révoque les sessions et supprime le compte, avec cascades sur ses données.

## Fonctionnement

- **Tableau de bord** : données des 30 derniers jours, dernières séances, programme prioritaire et reprise d’une séance.
- **Programmes** : journées réordonnables, exercices réordonnables, séries et fourchettes, charge et repos cibles, notes, duplication, suppression et supersets de deux exercices ou plus. Les programmes se sauvegardent explicitement avec le bouton dédié.
- **Séances** : démarrage depuis une journée ou séance libre, saisie de séries normales/échauffement/dégressives, charges décimales, répétitions choisies de 1 à 30, notes, ajout/retrait/réordre d’exercices, repos réels en minutes/secondes, brouillon et reprise. Les repos de tour de superset sont stockés séparément des repos par série. Aucun minuteur, vibration ou notification n’est lancé.
- **Bilan par séance** : après finalisation, graphique des séries par muscle, carte du corps et groupes directs/indirects pour cette seule séance, filtre des échauffements et totaux de répétitions, volume externe et cardio. Le bilan reste accessible depuis l’historique. Les tractions et dips assistés indiquent des kg d’assistance, exclus du volume externe et des records de charge.
- **Séances** : pagination par 30 séances, détails exacts, corrections et suppression confirmée. Depuis une séance terminée : « Refaire cette séance » crée une nouvelle séance active en conservant les exercices, prises, supersets et séries, avec charges et répétitions vides. « Créer un modèle » enregistre cette structure privée dans « Mes modèles de séance » ; lancement, renommage et suppression indépendants des séances. Les dernières performances restent dans la colonne « Précédent ». Les corrections recalculent statistiques et records.
- **Exercices** : 62 mouvements généraux, 269 fiches Technogym (dont 45 cardio) et 57 variantes de barres, pupitres, prises, tractions et dips, recherche FR/EN, collections Technogym/Cardio, catégories par gamme, filtres musculaires et équipement, affichage progressif et exercices personnels privés. Le sélecteur des programmes/séances dispose des mêmes collections et de la recherche. Les fonctions d’une machine double sont séparées pour conserver des historiques comparables. [Périmètre, modèles et sources](docs/TECHNOGYM.md). Les consignes françaises et schémas SVG sont originaux ; ils ne quantifient pas une activation.
- **Cardio** : intervalles avec durée minutes/secondes, distance facultative en km et notes de réglage. Une durée positive est obligatoire pour valider un intervalle. Les programmes définissent le nombre d’intervalles ; aucune répétition ou charge fictive n’est ajoutée. Les statistiques de durée et distance sont séparées des séries musculaires, du volume externe et des records. Les données sont saisies manuellement, sans connexion à Technogym/Mywellness ni chronomètre automatique.
- **Statistiques Recharts** : charge maximale, répétitions à charge fixée, volume, 1RM estimé, séries et périodes 7/30/90/180/365 jours ou tout l’historique. Carte du corps avant/arrière colorée selon le nombre de séries : 0, 1–5, 6–10, 11 et plus. Échauffements exclus par défaut, sollicitations primaires et secondaires consultables séparément. Données tabulaires accessibles sous le graphique et sous la carte.
- **Records** : recherche par exercice, nom anglais, machine ou prise, sans accents ; tri par nombre de séances pratiquées, puis alphabétique en cas d’égalité. Une séance terminée avec au moins une série de travail validée compte une fois par exercice, même s’il apparaît dans plusieurs blocs. Meilleure charge, meilleures charges par nombre de répétitions, 1RM estimé compatible, meilleur volume par exercice et séance. Pas de cache permanent à invalider.
- **Poids** : une mesure par date, correction/remplacement, suppression, courbe et chargement des mesures anciennes.
- **Paramètres** : pseudo, changement du mot de passe, suppression du compte, thème clair/sombre/système mémorisé et réglages du moteur de progression.

### Sauvegarde des séances

Après environ 800 ms sans nouvelle saisie, une sauvegarde est envoyée au serveur. Les sauvegardes se suivent dans l’ordre ; une saisie arrivée pendant un enregistrement est envoyée ensuite avec le nouveau numéro de version. Chaque RPC remplace les lignes enfant dans une seule transaction.

Une copie de récupération **propre au compte et à la séance** est immédiatement écrite dans ce navigateur. Elle ne remplace pas PostgreSQL. L’état « Enregistré sur le serveur » apparaît uniquement après une réponse positive. Un échec conserve la saisie, affiche une erreur et permet de réessayer ; le retour de connexion déclenche aussi un nouvel essai. Une nouvelle ouverture reprend une copie non synchronisée si sa version correspond. Un conflit bloque l’écrasement et propose de recharger la version serveur avec confirmation.

La copie locale peut contenir des données personnelles : utiliser un profil de navigateur personnel sur un ordinateur partagé. L’application ne prétend pas fonctionner intégralement hors ligne ; elle doit charger votre compte et votre séance depuis Supabase avant la reprise.

### Conventions de calcul

- Volume externe : somme `charge × répétitions` des séries effectuées et éligibles. Les échauffements sont exclus par défaut. Poids du corps et assistance ne sont pas mélangés aux charges externes.
- Pour les haltères, consigner la charge **par haltère**, avec la même convention dans toutes les séances. Aucun doublement automatique ; les volumes de mouvements différents ne sont pas des mesures physiques strictement équivalentes.
- Epley seulement sur exercices marqués compatibles, charge externe positive, séries normales de 1 à 10 répétitions. Une répétition utilise la charge réelle. Pas d’estimation sur assistance, poids du corps, échauffement ou drop set.
- Les muscles secondaires ne sont jamais ajoutés aux séries directes comme des contributions équivalentes.

### Surcharge progressive

Moteur déterministe dans `src/lib/metrics.ts`, sans service d’IA. Il utilise les séances terminées du même exercice, avec objectifs et nombres de séries comparables. Une machine différente doit avoir une identité d’exercice distincte : créer un exercice personnel si nécessaire.

Toutes les séries de travail normales prévues doivent atteindre la borne haute, à charge stable, avec technique/effort validés par l’utilisateur et sans dépassement des seuils disponibles, avant une suggestion d’augmentation. Les incréments initiaux sont 2,5 kg en haut du corps et 5 kg en bas, modifiables. L’absence de RPE/RIR n’est pas remplacée par une valeur inventée.

Sinon, le moteur propose des répétitions supplémentaires ou de stabiliser. Trois baisses comparables peuvent déclencher un signal prudent de fatigue possible, sans diagnostic ni changement automatique. Un repos nettement différent bloque une hausse ; les repos de tours sont utilisés pour les supersets lorsqu’aucun repos par série n’est saisi. Les échauffements et les données incohérentes sont exclus. Une suggestion acceptée dans la séance préremplit seulement les séries restantes ; une suggestion ignorée ne change rien au programme ni aux performances enregistrées.

## Architecture et sécurité

```text
src/app/                  Pages privées, connexion et routes HTTP
src/components/           Interface responsive, formulaires et graphiques
src/lib/domain.ts         Modèles Zod et construction des séances
src/lib/metrics.ts        Calculs, records et recommandations
src/lib/use-workout-save.ts Sauvegarde sérialisée, secours local et conflits
src/lib/supabase/         Clients exclusivement serveur
src/lib/database.types.ts Types des tables générés depuis PostgreSQL
supabase/migrations/      Schéma versionné, contraintes, index, RLS, RPC
supabase/seed.sql          Catalogue initial réexécutable
scripts/                  Administration, données et génération des types
tests/                    Calculs, PostgreSQL embarqué, React et Playwright
```

Les exercices sont partagés en lecture ou privés à leur créateur. Les profils, préférences, programmes, journées, groupes, séances, exercices de séance, séries, repos de tours et mesures sont des tables relationnelles. Les objectifs sont des colonnes distinctes des performances réelles. JSON n’est utilisé que comme format de transport des RPC ; les séances ne sont pas stockées en blocs JSON.

Toutes les tables exposées ont RLS. Les clés étrangères composites empêchent de rattacher un enfant au programme ou à la séance d’un autre compte. Des triggers empêchent les références à l’exercice privé ou à la journée d’un autre compte. Les anciens entraînements conservent leur nom et leurs objectifs lorsqu’un programme évolue. Les pages privées sont dynamiques ; les réponses authentifiées ne sont pas mises en cache publiquement.

Les mutations vérifient l’utilisateur côté serveur avec `getUser()`, leur origine et les schémas Zod. Les sessions utilisent des cookies `HttpOnly`, `SameSite=Lax`, sécurisés en HTTPS de production, renouvelés via `proxy.ts`. L’application n’emploie pas de client Supabase navigateur. La limitation de connexion est persistante en PostgreSQL : 8 tentatives par identifiant et 40 par IP sur 15 minutes, clés HMAC, erreurs génériques. Sur Vercel, l’IP provient du header renseigné par son proxy. Sur un autre hébergeur, le bucket IP est partagé jusqu’à l’intégration explicite d’un proxy de confiance.

Pour régénérer les types et le seed :

```powershell
npm run db:types
node --experimental-strip-types scripts/generate-seed.ts
```

`db:types` utilise les catalogues PostgreSQL réels de PGlite avec la migration ; aucune clé externe n’est nécessaire. Le client Supabase est paramétré avec ces types. Après une évolution distante, la génération Supabase CLI doit être comparée à ce schéma versionné.

## Tests et vérification

État vérifié le 16 octobre 2026 : voir `docs/VERIFICATION.md` pour le bilan exact et les limites.

```powershell
npm test                 # Vitest : calculs, règles métier, SQL/RLS et hook de sauvegarde
npm run typecheck
npm run lint
npm run build
npm run test:e2e          # Playwright : desktop et téléphone
```

Playwright utilise Microsoft Edge installé sur ce poste. Sur une autre machine, installer un navigateur Playwright (`npx playwright install chromium`) et définir `PLAYWRIGHT_CHANNEL=chromium`, ou sélectionner un canal installé. Les tests publics vérifient la connexion, le responsive et la protection des pages/API. Ils ne simulent pas une authentification réussie.

Les tests `tests/e2e/live.spec.ts` sont **ignorés tant qu’un projet Supabase de TEST n’est pas configuré**. Pour les activer : fournir les variables de `.env.example`, utiliser une instance de test avec la migration et le seed, et lancer :

```powershell
$env:E2E_LIVE = '1'
node --env-file=.env.local node_modules/@playwright/test/cli.js test
Remove-Item Env:E2E_LIVE
```

Le test admin crée deux comptes temporaires sans email, exécute le parcours programme → superset → saisie → brouillon → reprise → historique → graphique → records → thème → isolation, puis supprime ses comptes. Il n’utilise pas de données factices dans l’application et ne doit pas être lancé sur votre projet de production. Les erreurs de préparation/nettoyage font échouer le test. Les tests SQL embarqués vérifient les RLS sous des rôles PostgreSQL distincts, mais ne remplacent pas le service Auth, PostgREST ni les contrôles du projet hébergé.

## Déployer sur Vercel

1. Mettre le dépôt dans votre Git et l’importer comme projet **Next.js** sur Vercel.
2. Choisir Node.js 24 et les commandes `npm ci` / `npm run build`. La sortie est gérée par Next.js.
3. Ajouter les six variables de `.env.example` dans les environnements visés. Conserver les clés serveur comme secrets. Renseigner `APP_ORIGIN` avec l’URL HTTPS exacte de production ; pour les previews, utiliser une origine stable propre à cet environnement, pas un wildcard.
4. Déployer puis vérifier la connexion de deux comptes, la persistance après reconnexion, la reprise d’une séance et l’isolation via les tests sur un environnement de test équivalent.
5. Toute modification de variable sur Vercel nécessite un nouveau déploiement pour prendre effet. Les variables publiques sont intégrées au build : ne pas réutiliser un build d’un autre projet Supabase.

Les ressources distantes et l’état du déploiement sont consignés dans `docs/PROVISIONING.md`. L’aperçu local est indépendant du site publié.

## Limites restantes

- Le parcours privé complet avec une vraie session et la révocation de sessions restent à vérifier après la création des comptes. La configuration du projet hébergé et les contrôles effectués sont consignés dans `docs/PROVISIONING.md` et `docs/VERIFICATION.md`.
- Les historiques sont paginés. Les statistiques et records chargent les séances nécessaires en lots, puis calculent côté navigateur. Pour des volumes très importants, déplacer les agrégats en SQL et ne retourner que les points des graphiques ; aucune limite arbitraire n’est appliquée aux records, mais le coût croît avec l’historique.
- Le catalogue utilise des schémas anatomiques originaux comme illustrations de remplacement ; pas de photos/vidéos d’exécution ni de représentation détaillée de chaque mouvement. Pas de média tiers soumis à licence.
- Pas de calendrier mensuel, de réseau social, de notifications, de chronomètre ni de synchronisation entre appareils sans connexion. Les fonctionnalités optionnelles de calendrier et médias pourront être ajoutées.
- Une seule convention de charge est conservée par identité d’exercice. Créer une variante personnelle lorsqu’on change de machine ou de convention. Les exercices personnels créés ici ne sont pas éditables après création, pour préserver la cohérence de l’historique.
- Les supersets ont des tours et des séries indépendants : ajuster le nombre de séries prévu de chaque exercice si vous changez le nombre de tours.

## Références techniques

[SSR Supabase et Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [création administrative de comptes](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [configuration Auth](https://supabase.com/docs/guides/auth/general-configuration), [migrations](https://supabase.com/docs/guides/local-development/database-migrations), [Next.js sur Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [variables Vercel](https://vercel.com/docs/environment-variables).
