# Ressources créées le 16 octobre 2026

- Supabase : `forge-training`, organisation `MaelGibelot's Org`, région Paris (`eu-west-3`). Projet : `egzytutkpnkdyafgdsrv`.
- La création a été annoncée à 0 USD/mois par le connecteur. Les évolutions de consommation ou de formule sont régies par le compte Supabase.
- Schéma initial appliqué ; 62 exercices et 10 groupes musculaires installés ; RLS activée sur les 16 tables publiques.
- Index de production ajoutés après les diagnostics : aucune clé étrangère non indexée restante. Les index encore inutilisés sont attendus sur une base neuve.
- Vercel : projet `forge-training`, équipe `maelgibelot's projects`, ID `prj_yxhD75Uv1cEODVWCL68MIFqzIkwc`. Framework Next.js, Node.js 24, fonctions à Paris.
- GitHub : compte connecté au connecteur `MaelGibelot`. Aucun dépôt créé : cette opération n’est pas exposée par le connecteur disponible et la CLI n’est pas authentifiée.

Le projet Vercel n’est pas déployé et ne possède pas encore de connexion Git. L’URL et la clé publique Supabase sont configurées dans Vercel. Les secrets et la configuration Auth restent nécessaires avant la mise en service. Aucun compte utilisateur d’application n’a été créé.

Les tables `private.login_identities` et `private.login_attempts` n’ont intentionnellement aucune politique autorisant les clients : elles sont réservées aux fonctions serveur. Les diagnostics de sécurité ne les signalent qu’au niveau informatif ; ne pas ajouter de politique ouverte pour masquer ce signal.

Liens d’administration : [Supabase](https://supabase.com/dashboard/project/egzytutkpnkdyafgdsrv), [Vercel](https://vercel.com/maelgibelots-projects/forge-training).
