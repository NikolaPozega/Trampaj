import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const UPDATED = "26. svibnja 2025.";
const CONTACT = "info@trampaj.hr";

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

export default function TermsScreen() {
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
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Uvjeti korištenja</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.updated, { color: colors.mutedForeground }]}>
          Zadnja izmjena: {UPDATED}
        </Text>

        <View style={[styles.noticeBadge, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
          <Feather name="file-text" size={14} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.primary }]}>
            Korištenjem Trampaj.hr platforme prihvaćate ove Uvjete korištenja u cijelosti.
          </Text>
        </View>

        <Section title="1. Opis usluge" colors={colors}>
          <Body colors={colors}>
            {"Trampaj.hr je platforma koja omogućuje razmjenu (trampu) predmeta između fizičkih osoba. Platforma isključivo posreduje u spajanju korisnika — ne sudjeluje u transakcijama, ne preuzima odgovornost za predmete niti jamči uspješnu zamjenu.\n\nKorištenjem platforme potvrđujete da ste punoljetna osoba (18+) s pravnom sposobnošću za sklapanje ugovora."}
          </Body>
        </Section>

        <Section title="2. Registracija i korisnički račun" colors={colors}>
          <Body colors={colors}>
            {"• Registracija je besplatna i dobrovoljna\n• Korisnik je odgovoran za točnost unesenih podataka\n• Zabranjeno je kreirati lažne profile ili se predstavljati tuđim identitetom\n• Jedan korisnik smije imati samo jedan aktivan račun\n• Korisnik je dužan čuvati povjerljivost lozinke i odmah prijaviti svaki neovlašteni pristup\n• Platforma zadržava pravo suspendiranja ili brisanja računa koji krši ove Uvjete"}
          </Body>
        </Section>

        <Section title="3. Pravila oglašavanja" colors={colors}>
          <Body colors={colors}>
            {"Oglasi moraju biti točni, potpuni i u skladu s ovim pravilima. Zabranjeno je objavljivati:\n\n• Lažne ili obmanjujuće oglase\n• Predmete koji su predmet krađe, falsifikati ili ilegalna roba\n• Oružje, eksplozivi, droge i kontrolirane supstancije\n• Živežne namirnice i lijekovi koji zahtijevaju posebne uvjete pohrane\n• Sadržaj koji vrijeđa dostojanstvo osoba ili potiče mržnju\n• Predmete koji su zakonom zabranjeni za promet\n• Živa bića (životinje)\n\nKorisnik je osobno odgovoran za točnost i zakonitost objavljenih oglasa."}
          </Body>
        </Section>

        <Section title="4. Zabranjena ponašanja" colors={colors}>
          <Body colors={colors}>
            {"Zabranjeno je:\n\n• Kontaktirati korisnike s ciljem prijevare ili izvlačenja novca\n• Manipulirati ocjenama (lažne recenzije, samookjenjivanje)\n• Koristiti automatizirane alate za masovno objavljivanje oglasa (spam)\n• Prikupljati osobne podatke ostalih korisnika bez njihovog pristanka\n• Koristiti platformu za oglašavanje komercijalnih usluga ili reklama\n• Zaobilaziti mjere sigurnosti platforme"}
          </Body>
        </Section>

        <Section title="5. Zamjena predmeta i odgovornost" colors={colors}>
          <Body colors={colors}>
            {"Trampaj.hr posreduje u spajanju korisnika, ali:\n\n• NE garantira kvalitetu, stanje ili autentičnost predmeta\n• NE sudjeluje u fizičkoj razmjeni predmeta\n• NIJE odgovorna za štete nastale uslijed zamjene\n• NE pruža usluge prijevoza niti jamči dostavu\n\nKorisnici su sami odgovorni za dogovaranje uvjeta zamjene, provjeru predmeta i odabir sigurnog načina razmjene. Preporučujemo osobnu predaju ili korištenje provjerenih kurirskih službi."}
          </Body>
        </Section>

        <Section title="6. Dostava i plaćanje dostave" colors={colors}>
          <Body colors={colors}>
            {"Platforma ne naplaćuje proviziju niti posreduje u financijskim transakcijama.\n\nUkoliko korisnici dogovore kurirsku dostavu:\n• Svaki korisnik plaća dostavu paketa koji prima (Vinted model)\n• Trošak i organizacija dostave isključivo su dogovor između korisnika\n• Platforma ne snosi odgovornost za izgubljene, oštećene ili zakasnjele pošiljke\n\nZa predmete koji se ne mogu poslati kurirskom službom, korisnici se sami dogovaraju o osobnom preuzimanju."}
          </Body>
        </Section>

        <Section title="7. DSA — Digitalni tržišni akti (Uredba EU 2022/2065)" colors={colors}>
          <Body colors={colors}>
            {"Trampaj.hr posluje sukladno Uredbi o digitalnim uslugama (DSA):\n\n• Korisnici mogu prijaviti ilegalne ili sumnjive oglase putem gumba \"Prijavi oglas\"\n• Prijave se obrađuju unutar 72 sata\n• Platforma poduzima mjere uklanjanja nezakonitog sadržaja\n• Kontakt za tijela javne vlasti: " + CONTACT}
          </Body>
        </Section>

        <Section title="8. Intelektualno vlasništvo" colors={colors}>
          <Body colors={colors}>
            {"Korisnik zadržava autorska prava na fotografije i opise koje objavljuje. Objavljivanjem sadržaja dajete Trampaj.hr neekskluzivnu, besplatnu licencu za prikaz tog sadržaja unutar platforme.\n\nLogo, dizajn i naziv \"Trampaj.hr\" vlasništvo su operatora platforme i ne smiju se koristiti bez pismenog odobrenja."}
          </Body>
        </Section>

        <Section title="9. Ograničenje odgovornosti" colors={colors}>
          <Body colors={colors}>
            {"Platforma se pruža \"kakva jest\" bez jamstava dostupnosti ili prikladnosti. Operator ne odgovara za:\n\n• Izravne ili neizravne štete nastale korištenjem platforme\n• Gubitak podataka, prihoda ili poslovnih mogućnosti\n• Ponašanje ili propuste trećih osoba (korisnika, kurirskih službi)\n\nUkupna odgovornost operatora ograničena je na iznos koji je korisnik platio za korištenje usluge (usluga je besplatna)."}
          </Body>
        </Section>

        <Section title="10. Rješavanje sporova" colors={colors}>
          <Body colors={colors}>
            {"Za sporove između korisnika platforme preporučujemo rješavanje sporazumom.\n\nZa pritužbe na rad platforme pišite na: " + CONTACT + "\n\nNa ugovorne odnose primjenjuje se hrvatsko pravo. Nadležni sud je u Požegi.\n\nPotrošači imaju pravo koristiti platformu EU za mrežno rješavanje sporova:\nhttps://ec.europa.eu/consumers/odr"}
          </Body>
        </Section>

        <Section title="11. Izmjene uvjeta" colors={colors}>
          <Body colors={colors}>
            {"Uvjete možemo ažurirati. O bitnim izmjenama obavijestit ćemo vas unutar aplikacije ili e-mailom najmanje 30 dana unaprijed.\n\nAko ne prihvaćate izmjene, možete obrisati račun u postavkama profila."}
          </Body>
        </Section>

        <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="mail" size={15} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactTitle, { color: colors.foreground }]}>Kontakt</Text>
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
  noticeBadge: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sectionBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  contactCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  contactTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  contactEmail: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
