import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { InstrumentCategoryCreateInput, InstrumentCategoryListQueryInput, InstrumentCategoryUpdateInput } from "@/validators";
const select={id:true,name:true,description:true,isActive:true,createdAt:true,updatedAt:true} satisfies Prisma.InstrumentCategorySelect;
export type InstrumentCategoryRecord=Prisma.InstrumentCategoryGetPayload<{select:typeof select}>;
export const instrumentCategoryRepository={
 async list(f:InstrumentCategoryListQueryInput){const where:Prisma.InstrumentCategoryWhereInput={deletedAt:null,...(f.search?{OR:[{name:{contains:f.search,mode:"insensitive"}},{description:{contains:f.search,mode:"insensitive"}}]}:{}),...(f.isActive===undefined?{}:{isActive:f.isActive})};const skip=(f.page-1)*f.pageSize;const [categories,total]=await prisma.$transaction([prisma.instrumentCategory.findMany({where,select,orderBy:{[f.sortBy]:f.sortOrder},skip,take:f.pageSize}),prisma.instrumentCategory.count({where})]);return{categories,total};},
 findById(id:string){return prisma.instrumentCategory.findFirst({where:{id,deletedAt:null},select});},
 findByName(name:string,ignoreId?:string){return prisma.instrumentCategory.findFirst({where:{name:{equals:name,mode:"insensitive"},...(ignoreId?{id:{not:ignoreId}}:{})},select:{id:true}});},
 create(data:InstrumentCategoryCreateInput,userId:string){return prisma.instrumentCategory.create({data:{...data,createdById:userId,updatedById:userId},select});}, update(id:string,data:InstrumentCategoryUpdateInput,userId:string){return prisma.instrumentCategory.update({where:{id},data:{...data,updatedById:userId},select});}, softDelete(id:string,userId:string){return prisma.instrumentCategory.update({where:{id},data:{deletedAt:new Date(),isActive:false,updatedById:userId},select:{id:true}});}
};
