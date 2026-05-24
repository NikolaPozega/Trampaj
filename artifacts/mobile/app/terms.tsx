import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

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
          Zadnja izmjena: 24. svibnja 2025.
        </Text>

        <Section title="1. Prihvaćanje uvjeta" colors={colors}>
          Korištenjem platforme Trampaj.hr prihvaćate ove Uvjete korištenja. Ako se ne slažete, molimo vas da prestanete koristiti Platformu.
        </Section>

        <Section title="2. Opis usluge" colors={colors}>
          Trampaj.hr je posrednička platforma koja korisnicima omogućuje objavljivanje i pregledavanje oglasa za razmjenu (trampu) predmeta. Platforma NE sudjeluje u samim transakcijama između korisnika niti jamči za kvalitetu, točnost opisa ili sigurnost predmeta.
        </Section>

        <Section title="3. Uvjeti korištenja za korisnike" colors={colors}>
          Korisnik se obvezuje:{"\n"}
          • Navesti točne i istinite podatke u oglasima{"\n"}
          • Ne objavljivati zabranjene, ilegalne ili štetne sadržaje{"\n"}
          • Ne objavljivati oglase za: oružje, droge, lijekove na recept, ukradenu robu, zaštićena autorska prava bez dozvole, živu stoku{"\n"}
          • Poštivati prava trećih osoba (autorska prava, žigovi){"\n"}
          • Ne koristiti Platformu u komercijalne svrhe (preprodaja robe)
        </Section>

        <Section title="4. Zabranjen sadržaj" colors={colors}>
          Strogo je zabranjeno objavljivati oglase koji sadrže:{"\n"}
          • Ilegalne predmete ili usluge{"\n"}
          • Pornografski ili eksplicitni sadržaj{"\n"}
          • Govora mržnje, diskriminacije ili uznemiravanja{"\n"}
          • Osobne podatke trećih osoba bez privole{"\n"}
          Kršenje ovih odredbi može rezultirati trajnom zabranom korištenja.
        </Section>

        <Section title="5. Odgovornost" colors={colors}>
          Trampaj.hr nije stranka u transakcijama između korisnika i ne snosi odgovornost za:{"\n"}
          • Kvalitetu ili stanje predmeta trampe{"\n"}
          • Neispunjene dogovore između korisnika{"\n"}
          • Štete nastale korištenjem Platforme{"\n\n"}
          Korisnici snose punu odgovornost za zakonitost i valjanost predmeta koje nude.
        </Section>

        <Section title="6. Zaštita potrošača" colors={colors}>
          Sukladno Zakonu o zaštiti potrošača (NN 19/2022) i europskim direktivama, razmjena između fizičkih osoba nije komercijalna transakcija te se odredbe o potrošačkim pravima ne primjenjuju. Preporučujemo pisanu potvrdu dogovora pred razmjenu.
        </Section>

        <Section title="7. Autorska prava" colors={colors}>
          Sadržaj koji objavljujete (fotografije, opisi) i dalje je vaše vlasništvo. Objavom dajete Platformi neisključivu licencu za prikaz tog sadržaja unutar Platforme. Sav sadržaj Platforme (dizajn, logotip, kod) zaštićen je autorskim pravima.
        </Section>

        <Section title="8. Raskid i suspenzija" colors={colors}>
          Platforma zadržava pravo ukloniti sadržaj ili suspendirati korisnički račun bez prethodne najave u slučaju kršenja ovih Uvjeta. Korisnik može u svakom trenutku zatražiti brisanje svojih podataka (vidi Politiku privatnosti).
        </Section>

        <Section title="9. Mjerodavno pravo" colors={colors}>
          Na ove Uvjete primjenjuje se pravo Republike Hrvatske. Za sve sporove nadležni su sudovi u Republici Hrvatskoj, osim ako propisi EU-a ne predviđaju drukčije nadležnosti za potrošače.
        </Section>

        <Section title="10. Kontakt" colors={colors}>
          Za pitanja vezana uz Uvjete korištenja: legal@trampaj.hr
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
