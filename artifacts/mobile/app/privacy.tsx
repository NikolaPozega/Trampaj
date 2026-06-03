import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const UPDATED = "3. lipnja 2026.";
const CONTACT = "gdpr@trampaj.hr";

function Section({ title, children, colors }: {
  title: string; children: React.ReactNode;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {typeof children === "string"
        ? <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{children}</Text>
        : children}
    </View>
  );
}

function Body({ children, colors }: { children: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{children}</Text>;
}

export default function PrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Politika privatnosti</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.updated, { color: colors.mutedForeground }]}>
          Zadnja izmjena: {UPDATED}
        </Text>

        <View style={[styles.gdprBadge, { backgroundColor: `${colors.secondary}14`, borderColor: `${colors.secondary}30` }]}>
          <Feather name="shield" size={14} color={colors.secondary} />
          <Text style={[styles.gdprBadgeText, { color: colors.secondary }]}>
            Sukladno Uredbi EU 2016/679 (GDPR) i Zakonu o provedbi Opće uredbe (NN 42/2018)
          </Text>
        </View>

        <Section title="1. Voditelj obrade podataka" colors={colors}>
          <Body colors={colors}>
            {"Voditelj obrade osobnih podataka:\n\nDiplomat d.o.o.\nDr. F. Tuđmana 10, 34000 Požega\nOIB: 77718954672\n\nKontakt za zaštitu podataka: " + CONTACT + "\n\nNadzorno tijelo: Agencija za zaštitu osobnih podataka (AZOP), Martićeva 14, Zagreb — www.azop.hr"}
          </Body>
        </Section>

        <Section title="2. Koje osobne podatke prikupljamo" colors={colors}>
          <Body colors={colors}>
            {"• Korisničko ime i e-mail adresa (pri registraciji)\n• Lozinka (pohranjena isključivo kriptirana — bcrypt)\n• Broj mobitela (opcionalno — vidljiv samo u oglasima gdje ga sami objavite)\n• Adresa / lokacija (opcionalno — za prikaz oglasa u blizini)\n• Profilna fotografija (opcionalno)\n• Slike predmeta u oglasima (vidljive svim posjetiteljima)\n• Chat poruke između korisnika\n• Aktivnost: objavljeni oglasi, ocjene, status zamjena"}
          </Body>
        </Section>

        <Section title="3. Svrha i pravna osnova obrade" colors={colors}>
          <Body colors={colors}>
            {"• Izvršenje ugovora (čl. 6/1/b GDPR) — pružanje usluge trampe\n• Legitimni interes (čl. 6/1/f GDPR) — zaštita od prijevare i zlouporabe\n• Privola (čl. 6/1/a GDPR) — marketinške komunikacije (samo uz privolu)\n• Pravna obveza (čl. 6/1/c GDPR) — ispunjenje zakonskih zahtjeva\n\nPodaci se NE koriste za profiliranje niti izravni marketing bez vaše izričite privole."}
          </Body>
        </Section>

        <Section title="4. Pohrana i sigurnost" colors={colors}>
          <Body colors={colors}>
            {"Podaci se pohranjuju na sigurnim poslužiteljima unutar EU. Primjenjujemo sljedeće mjere zaštite:\n\n• Enkripcija lozinki (bcrypt)\n• HTTPS/TLS za svu komunikaciju\n• Ograničen pristup podacima — samo autorizirano osoblje\n• Redovite sigurnosne provjere i nadzor (Sentry)\n\nU slučaju povrede osobnih podataka koja može ugroziti vaša prava, obavijestit ćemo vas i AZOP u roku od 72 sata sukladno čl. 33. GDPR-a."}
          </Body>
        </Section>

        <Section title="5. Primatelji podataka (izvršitelji obrade)" colors={colors}>
          <Body colors={colors}>
            {"Radi pružanja usluge, dijelimo minimalne potrebne podatke s ovim pouzdanim trećim stranama:\n\n• Stripe Inc. (SAD/EU) — obrada kartičnih plaćanja pri kurirskoj dostavi; primjenjuje EU standardne ugovorne klauzule\n• Google Firebase / FCM — slanje push obavijesti (samo token uređaja, bez osobnih podataka)\n• Sentry (EU datacenter) — praćenje tehničkih grešaka aplikacije; prikuplja anonimiziranu tehničku dijagnostiku\n• Expo / EAS (SAD) — distribucija i ažuriranje mobilne aplikacije; ne prima osobne podatke korisnika\n• GLS / Box Now — kurirske službe; primaju adresu dostave samo ako sami odaberete kurirsku dostavu\n\nSve treće strane vezane su ugovorom o obradi podataka (DPA). Podaci se ne prodaju niti dijele u komercijalne svrhe."}
          </Body>
        </Section>

        <Section title="6. Vaša prava (GDPR)" colors={colors}>
          <Body colors={colors}>
            {"• Pravo na pristup — zatražite uvid u sve vaše podatke\n• Pravo na ispravak — ispravite netočne podatke u postavkama profila\n• Pravo na brisanje — \"Izbriši račun\" u profilu briše sve podatke unutar 30 dana\n• Pravo na prenosivost — zatražite izvoz podataka u JSON formatu\n• Pravo na ograničenje obrade — možete privremeno suspendirati obradu\n• Pravo na prigovor — protivite se obradi na temelju legitimnog interesa\n• Pravo na opoziv privole — u svakom trenutku bez posljedica\n\nZa zahtjeve pišite na: " + CONTACT + "\nOdgovaramo u roku od 30 dana (čl. 12. GDPR)."}
          </Body>
        </Section>

        <Section title="7. Rokovi pohrane" colors={colors}>
          <Body colors={colors}>
            {"• Osobni podaci čuvaju se dok je račun aktivan\n• Nakon brisanja računa — podaci se brišu unutar 30 dana\n• Objavljeni oglasi anonimiziraju se (uklanja se korisničko ime i kontakt)\n• Log podaci za sigurnost čuvaju se do 12 mjeseci\n• Neaktivni oglasi arhiviraju se nakon 90 dana"}
          </Body>
        </Section>

        <Section title="8. Maloljetnici" colors={colors}>
          <Body colors={colors}>
            {"Platforma nije namijenjena osobama mlađim od 18 godina. Korištenjem platforme potvrđujete da imate najmanje 18 godina. Ako saznamo da je maloljetna osoba koristila platformu, odmah ćemo obrisati njene podatke."}
          </Body>
        </Section>

        <Section title="9. Kolačići i analitika" colors={colors}>
          <Body colors={colors}>
            {"Mobilna aplikacija ne koristi kolačiće niti analitičke alate koji bi prikupljali podatke bez privole. Web stranica trampaj.hr koristi samo tehničke kolačiće neophodne za rad stranice. Ako budemo uveli analitiku, zatražit ćemo vašu privolu unaprijed uz jasno objašnjenje svrhe."}
          </Body>
        </Section>

        <Section title="10. Prigovori — AZOP" colors={colors}>
          <Body colors={colors}>
            {"Ako smatrate da obrađujemo vaše podatke protivno GDPR-u, možete podnijeti pritužbu:\n\nAgencija za zaštitu osobnih podataka (AZOP)\nMartićeva ulica 14, 10 000 Zagreb\nwww.azop.hr | azop@azop.hr"}
          </Body>
        </Section>

        <Section title="11. Izmjene politike" colors={colors}>
          <Body colors={colors}>
            {"Ovu politiku možemo ažurirati. O značajnim izmjenama obavijestit ćemo vas unutar aplikacije ili e-mailom najmanje 30 dana unaprijed. Nastavak korištenja smatra se prihvaćanjem izmjena."}
          </Body>
        </Section>

        <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="mail" size={15} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactTitle, { color: colors.foreground }]}>Kontakt za zaštitu podataka</Text>
            <Text style={[styles.contactEmail, { color: colors.secondary }]}>{CONTACT}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, justifyContent: "space-between", borderBottomWidth: 1 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  content: { padding: 20, gap: 20 },
  updated: { fontSize: 12, fontFamily: "Inter_400Regular" },
  gdprBadge: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  gdprBadgeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sectionBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  contactCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  contactTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  contactEmail: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
