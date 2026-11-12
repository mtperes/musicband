## The roles on the app will work in a tag system
so one user can have many roles


Admin - Godmode 

Viwer - View only
Músico - View / Upload / 


Produção - View / Edit / Add Member / Upload / Delete / Recive Mail
Accounting - View / Edit Accounting / 

## Contact email recipients

`production` receives public contact-form messages, as do active `admin` and legacy `owner` memberships. The independent `receive_mail` tag lets another active member receive messages without granting production or admin permissions. Role tags remain additive.

The server selects recipients from confirmed Auth accounts in the Sardinhas Nomades band. Inactive memberships and internal `.invalid` username identifiers are excluded. Matheus's primary destination remains `mt.peresn@gmail.com`; additional recipients are BCC so member addresses are not exposed to visitors or one another.

Receiving mail is implemented by `supabase/migrations/202611120001_contact_email.sql`. This change adds email-recipient tags only; it does not implement the other production permissions listed above.
