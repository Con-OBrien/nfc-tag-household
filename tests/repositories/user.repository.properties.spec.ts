import fc from 'fast-check';
import { UserRepository } from '../../src/repositories/UserRepository';
import { AppDataSource } from '../../src/config/database';
import { UserEntity } from '../../src/entities/User';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

/**
 * Property-Based Tests for UserRepository Household Isolation
 * **Validates: Property 4 (Household Isolation) and Requirements 6.1-6.6, 8.2**
 *
 * These tests use fast-check to verify that users can only access their own
 * household data. Cross-household queries always return empty results, and
 * household filtering is enforced at the database level across all operations.
 */
describe('UserRepository Properties - Household Isolation', () => {
  let userRepository: UserRepository;
  let repository: Repository<UserEntity>;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    repository = AppDataSource.getRepository(UserEntity);
  });

  beforeEach(async () => {
    await repository.delete({});
    userRepository = new UserRepository();
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  /**
   * Property: Users can only access their own household data
   * For any generated user/household assignments, users from one household
   * cannot retrieve or see users from another household
   */
  it('should enforce household isolation for findUsersInHousehold', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.array(
            fc.record({
              householdId: fc.uuid(),
              userName: fc.string({ minLength: 1, maxLength: 50 }),
              email: fc.string({ minLength: 5, maxLength: 50 }),
              userCount: fc.integer({ min: 1, max: 5 }),
            }),
            { minLength: 2, maxLength: 5 }
          )
        ),
        async ([householdSpecs]) => {
          // Create multiple households with users
          const createdUsers: Array<{ householdId: string; userId: string }> = [];

          for (const spec of householdSpecs) {
            for (let i = 0; i < spec.userCount; i++) {
              const user = await userRepository.createUser({
                householdId: spec.householdId,
                name: `${spec.userName}_${i}`,
                email: `${spec.email}_${i}@example.com`,
                passwordHash: 'hash',
                role: 'member',
                permissions: [],
                preferences: {
                  notificationsEnabled: true,
                  mutedTasks: [],
                  channels: ['push'],
                },
              });
              createdUsers.push({ householdId: spec.householdId, userId: user.userId });
            }
          }

          // Verify household isolation for each household
          for (const spec of householdSpecs) {
            const usersInHousehold = await userRepository.findUsersInHousehold(
              spec.householdId
            );

            // All returned users must belong to this household
            expect(usersInHousehold.every((u) => u.householdId === spec.householdId)).toBe(true);

            // All returned users must have been created in this household
            const expectedUserIds = createdUsers
              .filter((cu) => cu.householdId === spec.householdId)
              .map((cu) => cu.userId);

            for (const userId of expectedUserIds) {
              const found = usersInHousehold.find((u) => u.userId === userId);
              expect(found !== undefined).toBe(true);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cross-household queries return empty results
   * When querying users from household A with a user from household B,
   * the query should return empty results
   */
  it('should return empty results for cross-household queries', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.tuple(fc.uuid(), fc.uuid(), fc.integer({ min: 1, max: 5 })),
        async ([householdA, householdB, userCount]) => {
          // Ensure households are different
          expect(householdA !== householdB).toBe(true);

          // Create users only in household A
          for (let i = 0; i < userCount; i++) {
            await userRepository.createUser({
              householdId: householdA,
              name: `UserA_${i}`,
              email: `userA_${i}@example.com`,
              passwordHash: 'hash',
              role: 'member',
              permissions: [],
              preferences: {
                notificationsEnabled: true,
                mutedTasks: [],
                channels: ['push'],
              },
            });
          }

          // Query household B (which has no users)
          const usersInB = await userRepository.findUsersInHousehold(householdB);

          // Should be empty
          expect(usersInB.length).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Household filtering enforced at database level
   * Verify that the WHERE clause for household isolation is consistently applied
   */
  it('should enforce household filtering at database query level', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.tuple(fc.uuid(), fc.uuid()),
        async ([householdX, householdY]) => {
          // Ensure households are different
          expect(householdX !== householdY).toBe(true);

          // Create user in household X
          const user = await userRepository.createUser({
            householdId: householdX,
            name: 'TestUser',
            email: 'test@example.com',
            passwordHash: 'hash',
            role: 'member',
            permissions: [],
            preferences: {
              notificationsEnabled: true,
              mutedTasks: [],
              channels: ['push'],
            },
          });

          // Try to access with household Y
          const foundInY = await userRepository.findUserById(user.userId, householdY);

          // Should not find user
          expect(foundInY).toBeNull();

          // Verify user still exists in household X
          const foundInX = await userRepository.findUserById(user.userId, householdX);

          expect(foundInX).not.toBeNull();
          expect(foundInX!.userId).toBe(user.userId);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Users from household A cannot retrieve users from household B
   * Generate random user/household combinations and verify strict isolation
   */
  it('should prevent users from household A accessing household B data', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.uuid(), // householdA
          fc.uuid(), // householdB
          fc.integer({ min: 1, max: 3 }), // users in A
          fc.integer({ min: 1, max: 3 }) // users in B
        ),
        async ([householdA, householdB, usersACount, usersBCount]) => {
          // Ensure households are different
          expect(householdA !== householdB).toBe(true);

          // Create users in household A
          const usersA: string[] = [];
          for (let i = 0; i < usersACount; i++) {
            const user = await userRepository.createUser({
              householdId: householdA,
              name: `UserA_${i}`,
              email: `usera_${i}@example.com`,
              passwordHash: 'hash',
              role: 'member',
              permissions: [],
              preferences: {
                notificationsEnabled: true,
                mutedTasks: [],
                channels: ['push'],
              },
            });
            usersA.push(user.userId);
          }

          // Create users in household B
          const usersB: string[] = [];
          for (let i = 0; i < usersBCount; i++) {
            const user = await userRepository.createUser({
              householdId: householdB,
              name: `UserB_${i}`,
              email: `userb_${i}@example.com`,
              passwordHash: 'hash',
              role: 'member',
              permissions: [],
              preferences: {
                notificationsEnabled: true,
                mutedTasks: [],
                channels: ['push'],
              },
            });
            usersB.push(user.userId);
          }

          // Verify household A can only see household A users
          const visibleInA = await userRepository.findUsersInHousehold(householdA);

          // None of the household B users should be visible in household A
          for (const userBId of usersB) {
            const found = visibleInA.find((u) => u.userId === userBId);
            expect(found).toBeUndefined();
          }

          // All household A users should be visible
          for (const userAId of usersA) {
            const found = visibleInA.find((u) => u.userId === userAId);
            expect(found).not.toBeUndefined();
          }

          // Verify household B can only see household B users
          const visibleInB = await userRepository.findUsersInHousehold(householdB);

          // None of the household A users should be visible in household B
          for (const userAId of usersA) {
            const found = visibleInB.find((u) => u.userId === userAId);
            expect(found).toBeUndefined();
          }

          // All household B users should be visible
          for (const userBId of usersB) {
            const found = visibleInB.find((u) => u.userId === userBId);
            expect(found).not.toBeUndefined();
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Household isolation persists across multiple query types
   * Test that isolation works across different query methods
   */
  it('should maintain isolation across different query methods', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.tuple(fc.uuid(), fc.uuid()),
        async ([householdA, householdB]) => {
          expect(householdA !== householdB).toBe(true);

          // Create user in household A with specific email
          const userA = await userRepository.createUser({
            householdId: householdA,
            name: 'UserA',
            email: 'unique@example.com',
            passwordHash: 'hash',
            role: 'member',
            permissions: [],
            preferences: {
              notificationsEnabled: true,
              mutedTasks: [],
              channels: ['push'],
            },
          });

          // Try multiple query methods from household B

          // Method 1: findUsersInHousehold
          const foundInList = await userRepository.findUsersInHousehold(householdB);
          expect(foundInList.find((u) => u.userId === userA.userId)).toBeUndefined();

          // Method 2: findUserById (cross-household)
          const foundById = await userRepository.findUserById(userA.userId, householdB);
          expect(foundById).toBeNull();

          // Method 3: findByEmail (cross-household)
          const foundByEmail = await userRepository.findByEmail(
            'unique@example.com',
            householdB
          );
          expect(foundByEmail).toBeNull();

          // Verify user is still accessible from correct household
          const correctFind = await userRepository.findUserById(userA.userId, householdA);
          expect(correctFind).not.toBeNull();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Role-based filtering respects household isolation
   * Verify that role filtering doesn't bypass household isolation
   */
  it('should enforce household isolation even with role filtering', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.uuid(), // householdA
          fc.uuid(), // householdB
          fc.integer({ min: 1, max: 2 }) // owner count
        ),
        async ([householdA, householdB, ownerCount]) => {
          expect(householdA !== householdB).toBe(true);

          // Create owners in household A
          for (let i = 0; i < ownerCount; i++) {
            await userRepository.createUser({
              householdId: householdA,
              name: `Owner_${i}`,
              email: `owner_${i}@example.com`,
              passwordHash: 'hash',
              role: 'owner',
              permissions: [],
              preferences: {
                notificationsEnabled: true,
                mutedTasks: [],
                channels: ['push'],
              },
            });
          }

          // Create owners in household B
          for (let i = 0; i < ownerCount; i++) {
            await userRepository.createUser({
              householdId: householdB,
              name: `Owner_${i}`,
              email: `ownerb_${i}@example.com`,
              passwordHash: 'hash',
              role: 'owner',
              permissions: [],
              preferences: {
                notificationsEnabled: true,
                mutedTasks: [],
                channels: ['push'],
              },
            });
          }

          // Query owners from household B
          const ownersInB = await userRepository.findUsersInHousehold(householdB, 'owner');

          // Should only contain owners from household B
          expect(ownersInB.every((u) => u.householdId === householdB)).toBe(true);
          expect(ownersInB.every((u) => u.role === 'owner')).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Preference updates respect household isolation
   * Updating preferences in one household doesn't affect another
   */
  it('should enforce isolation when updating preferences', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.tuple(fc.uuid(), fc.uuid()),
        async ([householdA, householdB]) => {
          expect(householdA !== householdB).toBe(true);

          // Create users in both households
          const userA = await userRepository.createUser({
            householdId: householdA,
            name: 'UserA',
            email: 'usera@example.com',
            passwordHash: 'hash',
            role: 'member',
            permissions: [],
            preferences: {
              notificationsEnabled: true,
              mutedTasks: [],
              channels: ['push'],
            },
          });

          const userB = await userRepository.createUser({
            householdId: householdB,
            name: 'UserB',
            email: 'userb@example.com',
            passwordHash: 'hash',
            role: 'member',
            permissions: [],
            preferences: {
              notificationsEnabled: true,
              mutedTasks: [],
              channels: ['push'],
            },
          });

          // Try to update userA from household B perspective
          // This should fail because it would cross household boundaries
          await expect(
            userRepository.updateUserPreferences(userA.userId, householdB, {
              notificationsEnabled: false,
            })
          ).rejects.toThrow();

          // Verify userA still has original preferences
          const unchanged = await userRepository.findUserById(userA.userId, householdA);
          expect(unchanged!.preferences.notificationsEnabled).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
