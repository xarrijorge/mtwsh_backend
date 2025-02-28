export type UserRole= "admin" | "buyer" | "seller";

export interface User {
    id: string,
    username: string,
    email: string,
    password: string,
    role: UserRole,
}