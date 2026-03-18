jest.mock("../models/transaction.model", () => ({}));

jest.mock("../models/user.model", () => ({
  findById: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn()
}));

const UserModel = require("../models/user.model");
const { updateUserKycTier, listUsersByKycTier } = require("../controllers/admin.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

describe("admin controller - updateUserKycTier", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 404 when user does not exist", async () => {
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null)
    });

    const req = {
      params: { userId: "67f5b3102f1b0a0ad0f4d999" },
      body: { kycTier: "tier2" }
    };

    const res = createRes();

    await updateUserKycTier(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "User not found" })
    );
  });

  it("updates tier and returns previous/current values", async () => {
    const save = jest.fn().mockResolvedValue(null);
    const user = {
      _id: "67f5b3102f1b0a0ad0f4d111",
      firstName: "Tier",
      lastName: "User",
      userName: "tieruser",
      email: "tier@example.com",
      kycTier: "unverified",
      save
    };

    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user)
    });

    const req = {
      params: { userId: user._id },
      body: { kycTier: "tier3" }
    };

    const res = createRes();

    await updateUserKycTier(req, res);

    expect(user.kycTier).toBe("tier3");
    expect(save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          previousTier: "unverified",
          currentTier: "tier3"
        })
      })
    );
  });
});

describe("admin controller - listUsersByKycTier", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("lists all users without tier filter", async () => {
    const users = [
      { _id: "id1", firstName: "User", lastName: "One", userName: "user1", email: "user1@example.com", kycTier: "unverified", balance: 1000, savingsBalance: 5000, createdAt: new Date() },
      { _id: "id2", firstName: "User", lastName: "Two", userName: "user2", email: "user2@example.com", kycTier: "tier1", balance: 2000, savingsBalance: 10000, createdAt: new Date() }
    ];

    UserModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(users)
            })
          })
        })
      })
    });

    UserModel.countDocuments.mockResolvedValue(2);

    const req = {
      query: { page: 1, limit: 20 }
    };

    const res = createRes();

    await listUsersByKycTier(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ userName: "user1", kycTier: "unverified" }),
          expect.objectContaining({ userName: "user2", kycTier: "tier1" })
        ]),
        pagination: expect.objectContaining({ total: 2, totalPages: 1 })
      })
    );
  });

  it("filters users by tier", async () => {
    const users = [
      { _id: "id3", firstName: "Tier3", lastName: "User", userName: "tier3user", email: "tier3@example.com", kycTier: "tier3", balance: 50000, savingsBalance: 100000, createdAt: new Date() }
    ];

    UserModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(users)
            })
          })
        })
      })
    });

    UserModel.countDocuments.mockResolvedValue(1);

    const req = {
      query: { kycTier: "tier3", page: 1, limit: 20 }
    };

    const res = createRes();

    await listUsersByKycTier(req, res);

    expect(UserModel.find).toHaveBeenCalledWith({ kycTier: "tier3" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ kycTier: "tier3" })
        ])
      })
    );
  });

  it("paginates correctly", async () => {
    const users = [];
    
    UserModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(users)
            })
          })
        })
      })
    });

    UserModel.countDocuments.mockResolvedValue(250);

    const req = {
      query: { page: 3, limit: 50 }
    };

    const res = createRes();

    await listUsersByKycTier(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        pagination: expect.objectContaining({
          page: 3,
          limit: 50,
          total: 250,
          totalPages: 5,
          hasNextPage: true,
          hasPrevPage: true
        })
      })
    );
  });
});
