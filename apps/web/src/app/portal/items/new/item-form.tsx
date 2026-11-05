"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { createItem, type CreateItemResult, type ItemFormInput } from "./actions";

const MAX_PHOTOS = 6;
const MAX_BYTES = 20 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function uploadPhotos(shopId: string, itemId: string, photos: File[]) {
  const supabase = createClient();
  let failed = 0;
  for (const file of photos) {
    const ext = file.type.split("/")[1] ?? "jpg";
    const path = `${shopId}/${itemId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("item-files").upload(path, file, { contentType: file.type });
    if (upErr) { failed++; continue; }
    const { error: docErr } = await supabase.from("documents").insert({
      item_id: itemId,
      shop_id: shopId,
      kind: "photo",
      storage_path: path,
      sha256: await sha256Hex(file),
    });
    if (docErr) failed++;
  }
  return failed;
}

export function ItemForm() {
  const router = useRouter();
  const [metal, setMetal] = useState("gold");
  const [photos, setPhotos] = useState<File[]>([]);
  const [result, setResult] = useState<CreateItemResult>();
  const [photoError, setPhotoError] = useState<string>();
  const [busy, setBusy] = useState<false | "saving" | "uploading">(false);
  const fe = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function pickPhotos(list: FileList | null) {
    setPhotoError(undefined);
    const files = Array.from(list ?? []);
    const bad = files.find((f) => !PHOTO_TYPES.includes(f.type) || f.size > MAX_BYTES);
    if (bad) return setPhotoError(`${bad.name}: use JPEG, PNG, WebP or HEIC under 20 MB`);
    if (files.length > MAX_PHOTOS) return setPhotoError(`Up to ${MAX_PHOTOS} photos`);
    setPhotos(files);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (photoError) return;
    setBusy("saving");
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const input: ItemFormInput = {
      title: data.title ?? "",
      description: data.description ?? "",
      metal: data.metal ?? "",
      karat: data.karat ?? "",
      grossWeight: data.grossWeight ?? "",
      netWeight: data.netWeight ?? "",
      priceRupees: data.priceRupees ?? "",
      huids: data.huids ?? "",
      reportLab: data.reportLab ?? "",
      reportNumber: data.reportNumber ?? "",
    };
    const res = await createItem(input);
    setResult(res);
    if (!res.ok) return setBusy(false);

    if (photos.length) {
      setBusy("uploading");
      const failed = await uploadPhotos(res.shopId, res.itemId, photos);
      if (failed) {
        // The item is saved; tell the jeweller rather than lose their work.
        router.push(`/portal?saved=1&photoFailures=${failed}`);
        return;
      }
    }
    router.push("/portal?saved=1");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Item name" error={fe.title}>
        <Input name="title" required maxLength={120} placeholder="Temple necklace, 22K" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Metal" error={fe.metal}>
          <Select name="metal" value={metal} onChange={(e) => setMetal(e.target.value)}>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="platinum">Platinum</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        {metal === "gold" && (
          <Field label="Purity" error={fe.karat}>
            <Select name="karat" defaultValue="22">
              <option value="24">24K (999)</option>
              <option value="23">23K (958)</option>
              <option value="22">22K (916)</option>
              <option value="20">20K (833)</option>
              <option value="18">18K (750)</option>
              <option value="14">14K (585)</option>
            </Select>
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gross weight (g)" error={fe.grossWeight}>
          <Input name="grossWeight" required inputMode="decimal" pattern="[0-9]*[.]?[0-9]{0,3}" placeholder="32.540" />
        </Field>
        <Field label="Net weight (g)" hint="Optional, excluding stones" error={fe.netWeight}>
          <Input name="netWeight" inputMode="decimal" pattern="[0-9]*[.]?[0-9]{0,3}" />
        </Field>
      </div>

      <Field label="HUID" hint="The 6-character code on the hallmark. Separate several with commas." error={fe.huids}>
        <Input name="huids" placeholder="AB12CD" className="uppercase" autoCapitalize="characters" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label="Lab report" error={fe.reportLab}>
          <Select name="reportLab" defaultValue="">
            <option value="">None</option>
            <option value="GIA">GIA</option>
            <option value="IGI">IGI</option>
            <option value="HRD">HRD</option>
            <option value="SGL">SGL</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Report number" hint="Optional, for diamonds or gemstones" error={fe.reportNumber}>
          <Input name="reportNumber" maxLength={32} />
        </Field>
      </div>

      <Field label="Selling price (₹)" hint="Private to your shop. Never shown on the passport." error={fe.priceRupees}>
        <Input name="priceRupees" inputMode="decimal" placeholder="185000" />
      </Field>

      <Field label="Description" hint="Optional" error={fe.description}>
        <Textarea name="description" rows={3} maxLength={2000} />
      </Field>

      <Field label="Photos" hint={`Up to ${MAX_PHOTOS}. Take them on your phone camera.`} error={photoError}>
        <Input type="file" accept="image/*" multiple onChange={(e) => pickPhotos(e.target.files)} />
      </Field>

      <FormError message={result && !result.ok ? result.error : undefined} />
      <Button disabled={busy !== false}>
        {busy === "saving" ? "Saving…" : busy === "uploading" ? `Uploading ${photos.length} photo(s)…` : "Save item"}
      </Button>
    </form>
  );
}
