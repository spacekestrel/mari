const KEY = "mari-skip-delete-confirm";

function initial(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

class DeletePreferenceStore {
  skipConfirm = $state<boolean>(initial());

  set(value: boolean) {
    this.skipConfirm = value;
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, value ? "1" : "0");
  }
}

export const deletePreference = new DeletePreferenceStore();
