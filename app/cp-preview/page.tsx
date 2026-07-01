// TEMPORARY visual-verification route for the Content Planning rebuild. Delete after review.
import { ContentPlanningTools } from "@/app/_components/content-planning-tools";

function iso(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Page() {
  const carousels = [
    { id: "1", judul: "CCA #2 COMING SOON", tanggal_posting: iso(0), funnel: "TOFU", cta: "Follow", status: "Done", assignee_id: "p1", link_brief: null },
    { id: "2", judul: "KENAPA FRESH GRADS NGEBET MT", tanggal_posting: iso(0), funnel: "TOFU", cta: "MT From Zero", status: "Done", assignee_id: "p1", link_brief: "https://docs.google.com/x" },
    { id: "3", judul: "starter pack mt bank", tanggal_posting: iso(1), funnel: "TOFU", cta: "Follow", status: "Done", assignee_id: "p1", link_brief: null },
    { id: "4", judul: "perbedaan MT banking vs FMCG", tanggal_posting: iso(9), funnel: "MOFU", cta: null, status: "Draft", assignee_id: "p2", link_brief: null },
    { id: "5", judul: "gaji MT vs staff biasa", tanggal_posting: iso(9), funnel: "BOFU", cta: "Follow", status: "Draft", assignee_id: null, link_brief: null },
  ];
  const ctas = [{ id: "c1", label: "Follow" }, { id: "c2", label: "MT From Zero" }];
  const carouselLinks = [{ id: "l1", label: "Brief Instagram Carousel", url: "https://example.com" }];
  const dates = [{ id: "d1", tanggal: iso(0), status: "Draft" }, { id: "d2", tanggal: iso(2), status: "Done" }];
  const stories = [
    { id: "s1", date_id: "d1", urutan: 1, isi: "Hook: struggle fresh grad cari MT" },
    { id: "s2", date_id: "d1", urutan: 2, isi: "Pain point + solusi CCA" },
    { id: "s3", date_id: "d2", urutan: 1, isi: "Testimoni alumni" },
  ];
  const storyLinks = [{ id: "sl1", label: "Template Story", url: "https://example.com" }];
  const kols = [
    { id: "k1", nama: "Rani Putri", niche: "Career", platform: "Instagram", username: "raniputri", followers: 24000, contact: "wa 0812xxxx", notes: "Responsif, rate nego", rate_card_url: null, foto_url: null },
    { id: "k2", nama: "Dimas Aji", niche: "Finance", platform: "TikTok", username: "dimasaji", followers: 132000, contact: "email dimas@x.com", notes: "", rate_card_url: "https://example.com/rate.pdf", foto_url: null },
  ];
  const mtStories = [
    { id: "m1", nama: "Falah Akbar", perusahaan: "Unilever", batch: "MT 2024", wa: "0812xxxx", deskripsi: "Cerita lolos MT FMCG dari nol", is_posted: false, ig_url: "https://ig.com/x", linkedin_url: null, brief_url: null, foto_url: null },
    { id: "m2", nama: "Sinta Dewi", perusahaan: "BCA", batch: "MT 2023", wa: "0813xxxx", deskripsi: "Journey MT banking", is_posted: true, ig_url: null, linkedin_url: "https://linkedin.com/x", brief_url: null, foto_url: null },
  ];
  const people = [{ id: "p1", nama: "Falah Akbar", divisi_id: "mkt" }, { id: "p2", nama: "Michelle", divisi_id: "mkt" }];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <ContentPlanningTools dates={dates} stories={stories} storyLinks={storyLinks} carousels={carousels} carouselLinks={carouselLinks} ctas={ctas} kols={kols} mtStories={mtStories} people={people} />
    </div>
  );
}
