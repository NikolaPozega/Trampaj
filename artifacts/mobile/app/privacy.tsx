import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

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
          Zadnja izmjena: 24. svibnja 2025.
        </Text>

        <Section title="1. Voditelj obrade" colors={colors}>
          Trampaj.hr (dalje: „Platforma") je platforma za razmjenu dobara između fizičkih osoba na području Republike Hrvatske i šire regije. Voditelj obrade osobnih podataka je operater platforme sukladno Uredbi (EU) 2016/679 (GDPR) i Zakonu o provedbi Opće uredbe o zaštiti podataka (NN 42/2018).
        </Section>

        <Section title="2. Koje podatke prikupljamo" colors={colors}>
          • Korisničko ime (nadimak koji sami unesete){"\n"}
          • Broj telefona (opcionalno, vidljiv samo u vašim oglasima ako ga unesete){"\n"}
          • Sadržaj oglasa: naslov, opis, kategorija, lokacija, fotografija{"\n"}
          • Poruke razmijenjene između korisnika unutar Platforme{"\n"}
          • Tehničke informacije: vrsta uređaja, verzija OS-a (samo za tehničku podršku)
        </Section>

        <Section title="3. Svrha i pravna osnova obrade" colors={colors}>
          Vaši se podaci obrađuju isključivo radi:{"\n"}
          • Pružanja usluge posredovanja u trampi (izvršenje ugovora — čl. 6. st. 1. t. b) GDPR){"\n"}
          • Zaštite sigurnosti korisnika i sprječavanja zlouporabe (legitimni interes — čl. 6. st. 1. t. f) GDPR){"\n"}
          • Ispunjenja zakonskih obveza (čl. 6. st. 1. t. c) GDPR){"\n\n"}
          Podaci se NE koriste za izravni marketing bez vaše izričite privole.
        </Section>

        <Section title="4. Pohrana i sigurnost" colors={colors}>
          Svi podaci pohranjuju se lokalno na vašem uređaju (AsyncStorage). Platforma ne prenosi osobne podatke na vanjske poslužitelje bez vaše privole. Podaci se ne dijele s trećim stranama u komercijalne svrhe.
        </Section>

        <Section title="5. Vaša prava (GDPR)" colors={colors}>
          Sukladno GDPR-u imate pravo:{"\n"}
          • Pristupa — zatražiti uvid u vaše podatke{"\n"}
          • Ispravka — ispraviti netočne podatke{"\n"}
          • Brisanja — zatražiti brisanje svih podataka („pravo na zaborav"){"\n"}
          • Prijenosa — dobiti kopiju podataka u strojno čitljivom formatu{"\n"}
          • Prigovora — prigovoriti obradi temeljnoj na legitimnom interesu{"\n"}
          • Opoziva privole — opozvati privolu u svakom trenutku{"\n\n"}
          Brisanje svih lokalnih podataka dostupno je u postavkama profila → „Izbriši sve podatke".{"\n\n"}
          Za ostale zahtjeve pišite na: privacy@trampaj.hr
        </Section>

        <Section title="6. Zadržavanje podataka" colors={colors}>
          Podaci se čuvaju dok koristite Platformu ili dok ih sami ne obrišete. Neaktivni oglasi automatski se arhiviraju nakon 90 dana.
        </Section>

        <Section title="7. Maloljetnici" colors={colors}>
          Platforma nije namijenjena osobama mlađim od 18 godina. Korištenjem platforme potvrđujete da imate najmanje 18 godina.
        </Section>

        <Section title="8. Nadzorno tijelo" colors={colors}>
          Ako smatrate da je obrada vaših podataka u suprotnosti s GDPR-om, imate pravo podnijeti pritužbu Agenciji za zaštitu osobnih podataka (AZOP), Selska cesta 136, 10 000 Zagreb, www.azop.hr.
        </Section>

        <Section title="9. Izmjene politike" colors={colors}>
          Ova politika privatnosti može se mijenjati. O bitnim izmjenama bit ćete obaviješteni unutar Platforme. Nastavak korištenja after obavijesti smatra se prihvaćanjem.
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children, colors }: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{children}</Text>
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
  section: { gap: 8 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sectionBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
