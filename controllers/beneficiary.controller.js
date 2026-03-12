const UserModel = require("../models/user.model")

exports.addBeneficiary = async (req, res) => {
    try {
        const {accountNumber} = req.body

        if(!accountNumber){
            return res.status(400).send({success:false, 
            message:"accountNumber is required"})
        }

        const currentUser = await UserModel.findById(req.user.userId)
        
        if(!currentUser){
            return res.status(404).send({success:false,
            message:"Current user not found"})
        }

        const beneficiaryUser = await UserModel.findOne({accountNumber})

        if(!beneficiaryUser){
            return res.status(404).send({success:false,
            message:"Beneficiary account not found"})
        }

        if(beneficiaryUser._id.toString() === currentUser._id.toString()){
            return res.status(400).send({success:false,
            message:"Cannot add yourself as beneficiary"})
        }

        const alreadyAdded = currentUser.beneficiaries.some(b => b.toString() === beneficiaryUser._id.toString())

        if(alreadyAdded){
            return res.status(400).send({success:false,
            message:"Beneficiary already added"})
        }

        currentUser.beneficiaries.push(beneficiaryUser._id)
        await currentUser.save()

        res.status(200).send({success:true,
        message:"Beneficiary added successfully", data:{
        firstName: beneficiaryUser.firstName, 
        lastName: beneficiaryUser.lastName, 
        accountNumber: beneficiaryUser.accountNumber}})

    } catch (error) {
        res.status(500).send({success:false, 
        message:"Error adding beneficiary"})
    }
}

exports.getBeneficiaries = async (req, res) => {
    try {
        const currentUser = await UserModel.findById(req.user.userId)
            .populate('beneficiaries', 'firstName lastName accountNumber userName');

        if (!currentUser) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).send({
            success: true,
            message: "Beneficiaries retrieved successfully",
            data: currentUser.beneficiaries
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error retrieving beneficiaries"
        });
    }
};

exports.deleteBeneficiary = async (req, res) => {
    try {
        const { beneficiaryId } = req.params;

        if (!beneficiaryId) {
            return res.status(400).send({
                success: false,
                message: "Beneficiary ID is required"
            });
        }

        const currentUser = await UserModel.findById(req.user.userId);

        if (!currentUser) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        const beneficiaryIndex = currentUser.beneficiaries.findIndex(
            b => b.toString() === beneficiaryId
        );

        if (beneficiaryIndex === -1) {
            return res.status(404).send({
                success: false,
                message: "Beneficiary not found in your list"
            });
        }

        currentUser.beneficiaries.splice(beneficiaryIndex, 1);
        await currentUser.save();

        res.status(200).send({
            success: true,
            message: "Beneficiary removed successfully"
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Error removing beneficiary"
        });
    }
};