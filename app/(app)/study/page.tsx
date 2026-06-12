import { redirect } from "next/navigation";

// Study is deck-by-deck now (docs handoff §7): there is no global "study
// everything". Anyone landing on the bare /study goes back to the deck hub.
export default function StudyIndex() {
  redirect("/library");
}
