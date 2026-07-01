"use server";

import { auth } from "@/auth";
import { updateCollaborator } from "@/lib/api/collaborators";
import { revalidatePath } from "next/cache";

async function requireUser(){if(!(await auth())?.user)throw new Error("Unauthorized");}

export async function saveCollaboratorDetailsAction(id:string,formData:FormData){
  await requireUser();
  const obligations=String(formData.get("kewajiban")||"").split("\n").map((value)=>value.trim()).filter(Boolean);
  const services=String(formData.get("services")||"").split("\n").map((value)=>{const [label,...rate]=value.split("|");return{label:label.trim(),rate:rate.join("|").trim()};}).filter((item)=>item.label);
  await updateCollaborator(id,{rekening:String(formData.get("rekening")||"").trim(),privy:formData.get("privy")==="on",status:String(formData.get("status")||"").trim(),background:String(formData.get("background")||"").trim(),catatan:String(formData.get("catatan")||"").trim(),kewajiban:obligations,services});
  revalidatePath("/collaborators");
}

export async function updateCollaboratorPhotoAction(id:string,key:string){
  await requireUser();
  if(!key.startsWith("collaborator-photos/"))throw new Error("Invalid collaborator photo key.");
  await updateCollaborator(id,{foto_url:key});
  revalidatePath("/collaborators");
}
