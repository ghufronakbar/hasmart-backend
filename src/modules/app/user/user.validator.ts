import { z } from "zod";

export const UserStatusSchema = z.object({});

export type UserStatusType = z.infer<typeof UserStatusSchema>;

export const FirstTimeSetupBodySchema = z.object({
  name: z.string().min(3),
  password: z.string().min(6),
});

export type FirstTimeSetupBodyType = z.infer<typeof FirstTimeSetupBodySchema>;

export const LoginBodySchema = z.object({
  name: z.string(),
  password: z.string(),
});

export type LoginBodyType = z.infer<typeof LoginBodySchema>;

export const CreateUserBodySchema = z.object({
  name: z.string().min(3),
  password: z.string().min(6),
  isActive: z.boolean().default(true),
});

export type CreateUserBodyType = z.infer<typeof CreateUserBodySchema>;

export const EditProfileBodySchema = z.object({
  name: z.string().min(3),
});

export type EditProfileBodyType = z.infer<typeof EditProfileBodySchema>;

export const ChangePasswordBodySchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export type ChangePasswordBodyType = z.infer<typeof ChangePasswordBodySchema>;

export const ResetPasswordBodySchema = z.object({
  newPassword: z.string().min(6),
});

export type ResetPasswordBodyType = z.infer<typeof ResetPasswordBodySchema>;
