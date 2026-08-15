import { userRepository, type LocalUserProfile } from "@/repositories/userRepository";

export type UserProfile = Partial<LocalUserProfile> & { auth_user_id?: string };

export const profileService = {
  async getMyProfile(): Promise<UserProfile | null> {
    return userRepository.get();
  },

  async upsertMyProfile(p: Partial<UserProfile>): Promise<UserProfile | null> {
    return userRepository.update(p);
  },

  /** Salva o avatar localmente (data URL no SQLite). Sem storage remoto. */
  async uploadAvatar(file: File): Promise<string | null> {
    try {
      return await userRepository.saveAvatar(file);
    } catch (e) {
      console.error("[profile:avatar]", e);
      return null;
    }
  },
};
